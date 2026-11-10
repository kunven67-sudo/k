/* ================================================================
   THE MOON (Path B) — two years on. The colony, Jim's struggling
   stand, the half-built rocket, and five missing pieces.
   ================================================================ */
/* ---------- planet textures (equirectangular, procedural) ---------- */
function planetTex(kind,W=1024){
  const key='planet_'+kind+W; if(TEXCACHE[key]) return TEXCACHE[key];
  const H=W/2, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); const img=x.createImageData(W,H), d=img.data;
  const seed={earth:3,moon:7,mars:11}[kind];
  for(let j=0;j<H;j++){ const lat=(j/H-.5)*Math.PI; for(let i=0;i<W;i++){
    const lon=i/W*Math.PI*2; const px=Math.cos(lat)*Math.cos(lon), py=Math.sin(lat), pz=Math.cos(lat)*Math.sin(lon);
    const n=(sx,sy,sz)=>noise2(px*sx+pz*sz+seed,py*sy+pz*sx*.7+seed*2);
    let r,g,b;
    if(kind==='earth'){
      const e=n(1.6,1.6,1.3)*.6+n(3.5,3.5,3)*.3+n(8,8,7)*.12;
      const ice=smooth(invLerp(.72,.82,Math.abs(py)));
      if(e>.08){ const dry=n(5,5,4); const k=.8+n(20,20,18)*.2; r=(dry>.1?.52:.22)*k; g=(dry>.1?.45:.42)*k; b=(dry>.1?.28:.18)*k; if(e>.35){ r=g=b=.55*k; } }
      else { const deep=smooth(invLerp(.08,-.4,e)); r=lerp(.1,.02,deep); g=lerp(.32,.08,deep); b=lerp(.5,.26,deep); }
      r=lerp(r,.95,ice); g=lerp(g,.97,ice); b=lerp(b,1,ice);
    } else if(kind==='moon'){
      const e=n(2,2,2)*.5+n(6,6,5)*.3+n(16,16,14)*.2; const mare=smooth(invLerp(.1,.3,n(1.3,1.3,1.1)));
      const k=.55+e*.35-mare*.2; r=g=b=k; r*=1.02; b*=.98;
      const cr=Math.abs(n(30,30,26)); if(cr<.03){ r*=.75; g*=.75; b*=.75; }
    } else {
      const e=n(1.8,1.8,1.5)*.5+n(5,5,4)*.3+n(14,14,12)*.2; const k=.7+e*.4; r=.72*k; g=.36*k; b=.2*k;
      const dark=smooth(invLerp(.2,.45,n(2.5,2.5,2))); r*=1-dark*.4; g*=1-dark*.45; b*=1-dark*.4;
      const ice=smooth(invLerp(.85,.92,Math.abs(py))); r=lerp(r,.95,ice); g=lerp(g,.92,ice); b=lerp(b,.9,ice);
    }
    const k=(j*W+i)*4; d[k]=clamp(r,0,1)*255; d[k+1]=clamp(g,0,1)*255; d[k+2]=clamp(b,0,1)*255; d[k+3]=255; } }
  x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAX_ANISO; TEXCACHE[key]=t; return t;
}
function cloudTex(){ if(TEXCACHE._clouds) return TEXCACHE._clouds; const W=1024,H=512,c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'), img=x.createImageData(W,H), d=img.data;
  for(let j=0;j<H;j++){ const lat=(j/H-.5)*Math.PI; for(let i=0;i<W;i++){ const lon=i/W*Math.PI*2; const px=Math.cos(lat)*Math.cos(lon), py=Math.sin(lat), pz=Math.cos(lat)*Math.sin(lon); const n=noise2(px*3+pz*2.3,py*6+pz)*.6+noise2(px*9+pz*7,py*14)*.4; const a=smooth(invLerp(.05,.45,n)); const k=(j*W+i)*4; d[k]=d[k+1]=d[k+2]=255; d[k+3]=a*230; } }
  x.putImageData(img,0,0); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; TEXCACHE._clouds=t; return t; }
function atmosphere(r,colr,k=1.3){ return new THREE.Mesh(new THREE.SphereGeometry(r,48,32),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,uniforms:{c:{value:col(colr)},k:{value:k}},
  vertexShader:`varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform vec3 c; uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.2); gl_FragColor=vec4(c*f*k,f); }`})); }
function makePlanet(kind,r,o={}){
  const g=new THREE.Group();
  const m=new THREE.MeshStandardMaterial({map:planetTex(kind),roughness:kind==='earth'?.7:.95,metalness:0});
  if(kind==='earth'){ m.emissive=col(0x000000); }
  const body=mesh(new THREE.SphereGeometry(r,96,64),m,0,0,0,false); g.add(body);
  if(kind==='earth'){ const cl=mesh(new THREE.SphereGeometry(r*1.012,96,64),new THREE.MeshStandardMaterial({map:cloudTex(),transparent:true,depthWrite:false,roughness:1}),0,0,0,false); g.add(cl); g.userData.clouds=cl; g.add(atmosphere(r*1.06,0x5aa8ff,1.6)); }
  if(kind==='mars') g.add(atmosphere(r*1.04,0xffa070,.9));
  g.userData.body=body; return g;
}
/* ---------- the rocket (shared by moon / space / mars) ---------- */
const ROCKET_PARTS=['nozzle','tank','fin','nose','computer'];
const PART_NAMES={nozzle:'Engine nozzle',tank:'Fuel tank',fin:'Tail fin',nose:'Nose cone',computer:'Navigation computer'};
function makeRocket(o={}){
  const g=new THREE.Group();
  const white=new THREE.MeshPhysicalMaterial({color:col(0xeceff2),metalness:.3,roughness:.3,clearcoat:.8,clearcoatRoughness:.15});
  const red=new THREE.MeshPhysicalMaterial({color:col(0xc8281c),metalness:.3,roughness:.35,clearcoat:.8});
  const orange=new THREE.MeshPhysicalMaterial({color:col(0xf08a1a),metalness:.4,roughness:.35,clearcoat:.6});
  const dark=mat(0x2a2c30,{metalness:.9,roughness:.3}), glassM=new THREE.MeshPhysicalMaterial({color:col(0x223a4a),roughness:.05,metalness:.2,clearcoat:1});
  const parts={};
  const body=new THREE.Group(); g.add(body);
  body.add(cyl(1.1,1.1,6,white,0,4.2,0,48));
  for(const y of [1.6,6.9]) body.add(cyl(1.13,1.13,.18,red,0,y,0,48));
  for(let i=0;i<3;i++){ const pw=new THREE.Group(); pw.position.set(0,5.2+i*.1,0); pw.rotation.y=i*.4+.4; body.add(pw); const f=mesh(GC('porthole',()=>new THREE.TorusGeometry(.22,.05,10,24)),dark,0,0,1.1); pw.add(f); pw.add(mesh(GC('portGlass',()=>new THREE.CircleGeometry(.2,24)),glassM,0,0,1.11,false)); }
  const door=rbox(.9,1.6,.08,.06,white,0,2.6,1.08); body.add(door); body.add(box(.95,.06,.1,dark,0,3.43,1.1)); body.add(box(.95,.06,.1,dark,0,1.78,1.1));
  body.add(cyl(1.0,1.1,.3,dark,0,1.1,0,40));
  // --- collectable parts ---
  const nozzle=new THREE.Group(); nozzle.add(mesh(new THREE.CylinderGeometry(.55,1.0,1.1,40,1,true),mat(0x3a3c40,{metalness:1,roughness:.25,side:THREE.DoubleSide}),0,.4,0)); nozzle.add(cyl(.5,.55,.3,dark,0,.98,0,32)); nozzle.add(mesh(new THREE.TorusGeometry(1.0,.05,8,40),dark,0,-.15,0)).children; nozzle.children[2].rotation.x=Math.PI/2; parts.nozzle=nozzle;
  const tank=new THREE.Group(); tank.add(cyl(1.19,1.19,1.1,orange,0,0,0,48)); for(const y of [-.5,.5]) tank.add(cyl(1.21,1.21,.08,dark,0,y,0,48)); tank.position.y=3.5; parts.tank=tank;
  const finShape=new THREE.Shape(); finShape.moveTo(0,0); finShape.lineTo(1.3,-.3); finShape.lineTo(1.3,-1.1); finShape.lineTo(0,-1.9); finShape.closePath();
  const finGeo=new THREE.ExtrudeGeometry(finShape,{depth:.1,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2}); finGeo.translate(0,0,-.05);
  const fins=[]; for(let i=0;i<3;i++){ const f=new THREE.Group(); f.rotation.y=i*Math.PI*2/3; const fm=mesh(finGeo,red,1.05,3.1,0); f.add(fm); body.add(f); fins.push(f); }
  parts.fin=fins[0];
  const nose=new THREE.Group(); nose.add(mesh(new THREE.LatheGeometry([[0,0],[1.1,0],[1.08,.4],[.95,1.1],[.6,1.8],[.2,2.2],[0,2.3]].map(p=>new THREE.Vector2(p[0],p[1])),40),red,0,0,0)); nose.add(cyl(.02,.02,.6,dark,0,2.55,0,6)); nose.add(sph(.05,emissiveMat(0xff2a2a,3),0,2.85,0,10,8,false)); nose.position.y=7.2; parts.nose=nose;
  const comp=new THREE.Group(); comp.add(rbox(.7,.55,.35,.06,mat(0x5a6068,{metalness:.8,roughness:.3}),0,0,0)); comp.add(box(.5,.3,.02,emissiveMat(0x39ffb0,2.2),0,.04,.18,false)); comp.add(cyl(.015,.015,.5,dark,.25,.5,0,6)); comp.add(sph(.04,emissiveMat(0xffcc33,3),.25,.76,0,8,6,false)); comp.position.set(0,5.9,1.15); parts.computer=comp;
  nozzle.position.y=0; body.add(nozzle); body.add(tank); body.add(nose); body.add(comp);
  // ghost outlines where missing parts go
  const ghostM=new THREE.MeshBasicMaterial({color:col(0x39d8ff),transparent:true,opacity:.18,wireframe:true,depthWrite:false});
  const ghosts={};
  for(const k of ROCKET_PARTS){ const gh=parts[k].clone(); gh.traverse(o=>{ if(o.isMesh){ o.material=ghostM; o.castShadow=false; } }); gh.visible=false; (parts[k].parent).add(gh); gh.position.copy(parts[k].position); gh.rotation.copy(parts[k].rotation); ghosts[k]=gh; }
  // flame
  const flame=mesh(new THREE.ConeGeometry(.8,5,32,1,true),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{t:WIND.time,k:{value:0}},
    vertexShader:`varying vec2 vUv; uniform float t; void main(){ vUv=uv; vec3 p=position; p.x*=1.0+sin(t*40.0+position.y*3.0)*0.04; p.z*=1.0+cos(t*37.0+position.y*3.0)*0.04; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader:`varying vec2 vUv; uniform float t,k; void main(){ float y=vUv.y; float core=pow(y,1.5); vec3 c=mix(vec3(1.0,0.35,0.05),vec3(1.0,0.95,0.7),core)*(3.0+core*6.0); float fl=0.8+0.2*sin(t*50.0+vUv.x*30.0); gl_FragColor=vec4(c*fl*k*y,1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    }`}),0,-2.6,0,false);
  flame.rotation.x=Math.PI; g.add(flame);
  const fl=new THREE.PointLight(col(0xff8a3a),0,40,2); fl.position.set(0,-1.5,0); g.add(fl);
  g.userData={parts,ghosts,flame,flameLight:fl,body};
  return g;
}
function setRocketFlame(r,k){ r.userData.flame.material.uniforms.k.value=k; r.userData.flame.scale.set(1,.6+k*.6,1); r.userData.flameLight.intensity=k*6; }
/* ---------- moon terrain ---------- */
const MOON_CRATERS=[[40,-50,18,3.2],[-60,30,24,4],[70,40,14,2.4],[-30,-70,20,3],[10,80,16,2.6],[-90,-20,30,5],[95,-15,12,2],[-45,95,22,3.4],[55,-95,26,4.2],[-110,70,34,5.5],[120,90,28,4.8],[25,-40,6,1],[-22,42,7,1.1],[-65,-45,9,1.5],[62,68,8,1.3]];
function moonHeight(x,z){
  let h=fbm2(x*.012,z*.012,4)*3.2+fbm2(x*.06,z*.06,3)*.35;
  for(const [cx,cz,r,dp] of MOON_CRATERS){ const d=Math.hypot(x-cx,z-cz)/r; if(d<1.6){ h+= d<1?-dp*(1-d*d):0; h+=dp*.4*Math.exp(-Math.pow((d-1)/.2,2)); } }
  const center=Math.hypot(x,z);
  return h*smooth(invLerp(22,40,center));
}
defineLevel('moon',{
  title:'the moon colony',
  env:{fx:{exposure:1.05,saturation:1.0,contrast:1.14,bloomStrength:.2,bloomThreshold:1.8,aoRadius:.8,vignette:.4,temp:-.05},music:'moon',reverb:.02,amb:[['moonHum',.05]],ambEvents:[['moonRadio',18]],gravity:3.2,jump:4.4,surface:'moon',far:2500},
  async build(scene,lv){
    scene.background=col(0x000000);
    scene.add(makeStars(dq(2500,4000,7000,9000,12000),1800,{band:true,k:1.3}));
    const sunDir=V3(.55,.42,-.72).normalize();
    lv.sunWorld=sunDir.clone().multiplyScalar(1700);
    const sunDisk=mesh(new THREE.SphereGeometry(28,24,16),basicGlow(0xfff6e8,30),lv.sunWorld.x,lv.sunWorld.y,lv.sunWorld.z,false); scene.add(sunDisk);
    lv.envMap=makeEnv({top:0x05070c,horizon:0x2a2c34,bottom:0x8a8884,intensity:1.2,lights:[{x:sunDir.x*40,y:sunDir.y*40,z:sunDir.z*40,w:6,h:6,c:0xffffff,k:8},{x:-20,y:14,z:-30,w:8,h:8,c:0x6aa8ff,k:1.2}]});
    const rig=makeRig(scene,{sun:4.2,sunColor:0xfff4e6,hemi:.38,sky:0x6a7a98,ground:0x9a968e,dir:sunDir,span:24,dist:90,far:220,bias:-.0006});
    // Earth, big and blue, low in the sky
    lv.earth=makePlanet('earth',120); lv.earth.position.set(-620,300,-900); lv.earth.rotation.set(.3,1.2,.1); scene.add(lv.earth);
    // terrain
    const S=dq(120,160,220,260,300);
    const tg=new THREE.PlaneGeometry(520,520,S,S); tg.rotateX(-Math.PI/2); const tp=tg.attributes.position;
    for(let i=0;i<tp.count;i++){ tp.setY(i,moonHeight(tp.getX(i),tp.getZ(i))); } tg.computeVertexNormals();
    const reg=texSet('regolith',512,(x,w,h)=>{ noiseFill(x,w,h,n=>{ const v=150+n*70; return [v,v*.98,v*.95]; },6,5); for(let i=0;i<900;i++){ const r=rand(1,6); const v=rand(60,200); x.fillStyle=`rgba(${v},${v},${v},${rand(.1,.4)})`; x.beginPath(); x.arc(rand(0,w),rand(0,h),r,0,7); x.fill(); } for(let i=0;i<40;i++){ const cx=rand(0,w),cy=rand(0,h),r=rand(4,18); x.strokeStyle='rgba(40,40,40,.35)'; x.lineWidth=2; x.beginPath(); x.arc(cx,cy,r,0,7); x.stroke(); x.strokeStyle='rgba(230,230,230,.25)'; x.beginPath(); x.arc(cx+1,cy+1,r,3.5,6); x.stroke(); } },{strength:3.5});
    const rr=repeatSet(reg,90,90);
    const ground=mesh(tg,new THREE.MeshStandardMaterial({map:rr.map,normalMap:rr.normalMap,roughness:1,color:col(0xb0aca6)}),0,0,0,false); ground.receiveShadow=true; scene.add(ground);
    lv.hf=heightField(520,S,moonHeight); lv.ground=(x,z)=>lv.hf.at(x,z);
    // boulders
    const rockM=new THREE.MeshStandardMaterial({color:col(0x8a8680),roughness:1,normalMap:reg.normalMap});
    const rocks=new Builder(); const rgen=RNG(9);
    for(let i=0;i<dq(40,70,110,150,200);i++){ const x=rgen()*400-200, z=rgen()*400-200; if(Math.hypot(x,z)<28) continue; const s=rgen()*1.6+.3; rocks.add(crumbGeo(300+i%20,1),rockM,x,moonHeight(x,z)+s*.2,z,rgen()*3,rgen()*3,rgen()*3,s,s*.7,s); if(s>1.1) colCircle(lv.col,x,z,s*.8); }
    const rk=rocks.build(true,true); scene.add(rk);
    // ---------------- the colony ----------------
    const glass=new THREE.MeshPhysicalMaterial({color:col(0xcfe8ff),roughness:.05,transparent:true,opacity:.16,clearcoat:1,side:THREE.DoubleSide,depthWrite:false,envMapIntensity:1.5});
    const frameM=new THREE.LineBasicMaterial({color:col(0xd8e0e8),transparent:true,opacity:.55});
    const hull=new THREE.MeshPhysicalMaterial({color:col(0xe4e6ea),metalness:.4,roughness:.35,clearcoat:.5});
    const domes=[[18,-18,9],[-22,-14,11],[-6,24,8],[24,16,7],[-30,14,6]];
    lv.domeLights=[];
    domes.forEach(([x,z,r],di)=>{
      const g=new THREE.Group(); g.position.set(x,0,z); scene.add(g);
      g.add(mesh(new THREE.SphereGeometry(r,48,24,0,Math.PI*2,0,Math.PI/2),glass,0,0,0,false));
      const eg=new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r*1.002,2)); const ep=eg.attributes.position; const keep=[]; for(let i=0;i<ep.count;i+=2){ if(ep.getY(i)>=-.01&&ep.getY(i+1)>=-.01) keep.push(ep.getX(i),ep.getY(i),ep.getZ(i),ep.getX(i+1),ep.getY(i+1),ep.getZ(i+1)); }
      const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(keep,3)); g.add(new THREE.LineSegments(lg,frameM));
      g.add(cyl(r+.3,r+.4,.6,hull,0,.3,0,48));
      // interior: little buildings, plants, warm lights
      const inner=new Builder(); const r2=RNG(di*9+2);
      for(let k=0;k<5;k++){ const a=r2()*6.28, d=r2()*r*.55; const w=rand(1.5,3), hh=rand(1.5,3.5); inner.add(UBOX,hull,Math.cos(a)*d,hh/2,Math.sin(a)*d,0,r2()*3,0,w,hh,w); }
      g.add(inner.build(true,true));
      for(let k=0;k<3;k++){ const a=k*2.1; g.add(box(.5,.4,.05,emissiveMat(0xffd08a,3),Math.cos(a)*r*.4,1.8,Math.sin(a)*r*.4,false)); }
      makeBushes(g,[{x:r*.3,z:r*.2,h:1.3,r:.9},{x:-r*.35,z:-r*.1,h:1,r:.7}],{seed:di+40,tint:0xc8ffd0});
      const pl=new THREE.PointLight(col(0xffc88a),1.4,r*2.2,2); pl.position.set(0,r*.6,0); g.add(pl); lv.domeLights.push(pl);
      colCircle(lv.col,x,z,r+.5);
      lv.domes=lv.domes||[]; lv.domes.push({x,z,r});
    });
    // tubes between domes
    for(const [a,b] of [[0,3],[1,4],[2,4]]){ const A=domes[a], B=domes[b]; const dx=B[0]-A[0], dz=B[1]-A[1]; const len=Math.hypot(dx,dz); const t=cyl(1.2,1.2,len,hull,(A[0]+B[0])/2,1.2,(A[1]+B[1])/2,24); t.rotation.set(Math.PI/2,0,-Math.atan2(dx,dz)); t.rotation.order='YXZ'; t.rotation.set(Math.PI/2,Math.atan2(dx,dz),0); scene.add(t); colOBox(lv.col,(A[0]+B[0])/2,(A[1]+B[1])/2,2.5,len,Math.atan2(dx,dz)); }
    // antenna tower
    const ant=new THREE.Group(); ant.position.set(34,moonHeight(34,-2),-2); scene.add(ant);
    const aM=mat(0xb8bcc0,{metalness:.8,roughness:.3});
    for(let i=0;i<4;i++){ const a=i/4*Math.PI*2+.785; ant.add(cyl(.06,.1,16,aM,Math.cos(a)*.6,8,Math.sin(a)*.6,6)); }
    for(let y=1;y<16;y+=1.5){ ant.add(box(1.3,.06,.06,aM,0,y,.6)); ant.add(box(1.3,.06,.06,aM,0,y,-.6)); }
    const dish=mesh(new THREE.SphereGeometry(2.2,32,16,0,Math.PI*2,0,.9),new THREE.MeshStandardMaterial({color:col(0xf0f0f0),metalness:.3,roughness:.4,side:THREE.DoubleSide}),0,15,1.2); dish.rotation.x=-1.2; ant.add(dish);
    lv.beacon=sph(.2,emissiveMat(0xff2a1a,6),0,16.4,0,10,8,false); ant.add(lv.beacon);
    colCircle(lv.col,34,-2,1.2);
    // solar arrays
    const panelT=canvasTex(128,256,(x,w,h)=>{ x.fillStyle='#0a1a3a'; x.fillRect(0,0,w,h); x.strokeStyle='#8aa0c8'; x.lineWidth=2; for(let i=0;i<=w;i+=32){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,h); x.stroke(); } for(let j=0;j<=h;j+=32){ x.beginPath(); x.moveTo(0,j); x.lineTo(w,j); x.stroke(); } });
    const pM=new THREE.MeshPhysicalMaterial({map:panelT,metalness:.6,roughness:.2,clearcoat:1});
    for(let i=0;i<6;i++){ const p=new THREE.Group(); const px=-48+i*4.5, pz=-34; p.position.set(px,moonHeight(px,pz),pz); scene.add(p); p.add(cyl(.08,.08,1.6,aM,0,.8,0,6)); const pn=box(3.2,.06,6,pM,0,1.7,0); pn.rotation.x=-.5; p.add(pn); colBoxC(lv.col,px,pz,3.4,5.4); }
    // rover
    const rov=new THREE.Group(); rov.position.set(-16,moonHeight(-16,-34),-34); rov.rotation.y=.6; scene.add(rov);
    rov.add(rbox(2.4,.5,1.4,.1,hull,0,.9,0)); rov.add(rbox(1,.6,1,.1,glass,.4,1.4,0)); for(const [x,z] of [[-.9,-.8],[.9,-.8],[-.9,.8],[.9,.8]]){ const w=mesh(new THREE.CylinderGeometry(.38,.38,.3,20),mat(0x3a3a3a,{roughness:.9}),x,.4,z); w.rotation.x=Math.PI/2; rov.add(w); }
    rov.add(cyl(.02,.02,1.2,aM,-.8,1.6,.4,6)); colCircle(lv.col,-16,-34,1.6);
    // ---------------- Jim's (struggling) stand ----------------
    const S2=new THREE.Group(); S2.position.set(0,0,-6); scene.add(S2); lv.stand=S2;
    const ply=texMat(woodTex('ply',512,{planks:2,base:[170,140,100]}),1,1,{opts:{roughness:1}});
    const sheet=mat(0x8a9098,{metalness:.8,roughness:.5});
    S2.add(box(4.4,1.1,1.4,ply,0,.55,0)); S2.add(box(4.6,.08,1.6,sheet,0,1.14,0)); for(const sd of [-1,1]) S2.add(box(.12,2.6,.12,sheet,sd*2.1,1.3,-.6)); S2.add(box(4.8,.1,1.9,sheet,0,2.65,-.3));
    const patch=box(.8,.5,.02,sheet,-1.2,.6,.71); patch.rotation.z=.1; S2.add(patch); S2.add(box(.6,.3,.02,mat(0x6a5a4a),1.1,.4,.71));
    const moonSign=neonSignTex([{text:"JIM'S BUG BITES",font:'bold 120px Impact, Arial Black, sans-serif',color:'#ffcc33',glow:'#ff8a00',y:.45,blur:20},{text:'(business is slow)',font:'italic 52px Georgia, serif',color:'#9fe0ff',glow:'#3a8aff',y:.84,blur:8}]);
    const ms=mesh(new THREE.PlaneGeometry(3.6,.9),new THREE.MeshBasicMaterial({map:moonSign}),0,3.25,-.25,false); ms.material.color.setScalar(1.6); S2.add(ms); S2.add(box(3.7,1,.06,sheet,0,3.25,-.3));
    lv.moonSignMat=ms.material;
    const tipJar=cyl(.1,.1,.22,new THREE.MeshPhysicalMaterial({color:col(0xffffff),transparent:true,opacity:.3,roughness:.05,clearcoat:1}),1.6,1.29,.3,16,false); S2.add(tipJar);
    const tipT=canvasTex(128,64,(x)=>{ x.fillStyle='#fff'; x.fillRect(0,0,128,64); x.fillStyle='#222'; x.font='bold 22px sans-serif'; x.textAlign='center'; x.fillText('TIPS :(',64,40); });
    S2.add(mesh(new THREE.PlaneGeometry(.2,.1),new THREE.MeshBasicMaterial({map:tipT}),1.6,1.3,.41,false));
    const grill=rbox(1,.2,.6,.03,mat(0x2a2a2a,{metalness:.8,roughness:.4}),-1,1.28,0); S2.add(grill);
    colBoxC(lv.col,0,-6,4.9,2);
    lv.jim=makeJim({shirt:0xc89a40}); lv.jim.userData.level='moon'; scene.add(lv.jim);
    // ---------------- the rocket + pad + scaffold ----------------
    const RP=V3(-14,0,6); lv.rocketPos=RP;
    const pad=cyl(5,5.4,.4,texMat(TX.concrete(),3,3,{opts:{roughness:1,color:col(0x9a9894)}}),RP.x,.2,RP.z,8); scene.add(pad);
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; scene.add(box(.6,.05,.2,emissiveMat(0xffcc33,2),RP.x+Math.cos(a)*4.6,.42,RP.z+Math.sin(a)*4.6,false)); }
    lv.rocket=makeRocket(); lv.rocket.position.set(RP.x,.4+1.1,RP.z); lv.rocket.rotation.y=-.6; scene.add(lv.rocket);
    const scaff=new THREE.Group(); scaff.position.set(RP.x+3.2,.4,RP.z-1.6); scene.add(scaff);
    const sM=mat(0xd8a020,{metalness:.7,roughness:.4});
    for(const [x,z] of [[-.8,-.8],[.8,-.8],[-.8,.8],[.8,.8]]) scaff.add(box(.1,10,.1,sM,x,5,z));
    for(let y=1;y<10;y+=1.6){ scaff.add(box(1.7,.08,.08,sM,0,y,-.8)); scaff.add(box(1.7,.08,.08,sM,0,y,.8)); scaff.add(box(.08,.08,1.7,sM,-.8,y,0)); scaff.add(box(.08,.08,1.7,sM,.8,y,0)); }
    scaff.add(box(2.6,.08,.9,mat(0x5a5e62,{metalness:.8}),-1.2,5.2,0));
    colCircle(lv.col,RP.x,RP.z,5.2);
    lv.ground=(x,z)=>{ if(Math.hypot(x-RP.x,z-RP.z)<5) return .4; return lv.hf.at(x,z); };
    // ---------------- the five pieces, scattered ----------------
    const spots=[['nozzle',V3(38,0,-48)],['tank',V3(-58,0,-30)],['fin',V3(-12,0,58)],['nose',V3(52,0,42)],['computer',V3(-40,0,-66)]];
    lv.pieces=spots.map(([k,p])=>{
      const raw=lv.rocket.userData.parts[k].clone(); raw.position.set(0,0,0); raw.rotation.set(0,0,0);
      const scale=k==='tank'||k==='nozzle'?.55:k==='nose'?.5:k==='fin'?.7:1;
      const obj=new THREE.Group(); obj.add(raw); raw.scale.setScalar(scale);
      if(k==='fin'){ raw.rotation.z=Math.PI/2.3; } if(k==='tank') raw.rotation.x=Math.PI/2;
      obj.updateMatrixWorld(true); const bb=new THREE.Box3().setFromObject(raw); const ctr=bb.getCenter(new THREE.Vector3()); raw.position.sub(ctr); obj.userData.h=bb.getSize(new THREE.Vector3()).y/2+.15;
      obj.userData.vmScale=k==='nozzle'?.5:k==='tank'?.4:k==='nose'?.45:k==='fin'?.5:1.1;
      const wrap=new THREE.Group(); wrap.add(obj); const y=moonHeight(p.x,p.z);
      wrap.position.set(p.x,y,p.z); scene.add(wrap);
      const beam=mesh(new THREE.CylinderGeometry(.35,.35,60,16,1,true),new THREE.MeshBasicMaterial({color:col(0xffcc33),transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),0,30,0,false); wrap.add(beam);
      const ring=mesh(new THREE.RingGeometry(1.2,1.4,40),new THREE.MeshBasicMaterial({color:col(0xffcc33).multiplyScalar(2),transparent:true,opacity:.7,side:THREE.DoubleSide}),0,.05,0,false); ring.rotation.x=-Math.PI/2; wrap.add(ring);
      const pl=new THREE.PointLight(col(0xffc040),1.2,8,2); pl.position.y=1.2; wrap.add(pl);
      return {key:k,wrap,obj,beam,ring,collected:false,installed:false,vmScale:k==='nozzle'?.28:k==='tank'?.2:k==='nose'?.2:k==='fin'?.3:.6};
    });
    // colonists (the aliens from Ant Work 1's moon)
    lv.colonists=[];
    const loops=[[V3(10,0,-10),V3(14,0,-4),V3(8,0,4),V3(2,0,8),V3(-4,0,2)],[V3(-12,0,-4),V3(-18,0,-2),V3(-16,0,8),V3(-8,0,10)],[V3(4,0,14),V3(12,0,10),V3(18,0,4)]];
    for(let i=0;i<3;i++){ const a=makeAlien({skin:[0x3f9be8,0x62bcff,0x8a7ae8][i],shirt:[0x5a2fa0,0x0f8a86,0x2a4a9a][i]}); a.userData.level='moon'; a.position.copy(loops[i][0]); scene.add(a); lv.colonists.push({h:a,loop:loops[i],i:0}); }
    lv.col.radius=200; lv.col.cx=0; lv.col.cz=0;
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.12; FX.raysColor.set(1,1,1); },
  update(dt,t){
    const lv=this; WIND.time.value=t;
    lv.earth.rotation.y+=dt*.004; if(lv.earth.userData.clouds) lv.earth.userData.clouds.rotation.y+=dt*.002;
    lv.beacon.material.emissiveIntensity=Math.sin(t*3)>0?7:.3;
    for(const p of lv.pieces){ if(p.collected) continue; p.obj.rotation.y+=dt*.6; p.obj.position.y=(p.obj.userData.h||.4)+Math.sin(t*2+p.wrap.position.x)*.12; p.ring.scale.setScalar(1+Math.sin(t*3)*.08); p.beam.material.opacity=.14+Math.sin(t*2)*.06; }
    for(const k of ROCKET_PARTS){ const gh=lv.rocket.userData.ghosts[k]; if(gh.visible) gh.traverse(o=>{ if(o.material) o.material.opacity=.12+Math.sin(t*4)*.08; }); }
    for(const c of lv.colonists){ if(!c.h.userData.A.path && !c.pause){ c.i=(c.i+1)%c.loop.length; const to=c.loop[c.i].clone(); walkTo(c.h,[to],1.1).then(()=>{ c.pause=true; later(rand(1,4),()=>c.pause=false); }); } c.h.position.y=lv.ground(c.h.position.x,c.h.position.z); }
    if(lv.moonSignMat) lv.moonSignMat.color.setScalar(Math.random()<.02?.5:1.6);
  }
});

