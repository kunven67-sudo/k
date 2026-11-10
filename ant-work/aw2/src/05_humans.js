/* ================================================================
   HUMANS v4 — sculpted heads with morph-target mouths & expressions,
   real eyes, grown hair/beard shells, skin with fake subsurface,
   layered pose / walk / look / talk animation.  Aliens + robots too.
   ================================================================ */
const HUMANS=[];
/* ---- skin: wrapped diffuse with a warm terminator (cheap subsurface look) ---- */
function skinify(m,tint=[1,.66,.56],wrap=.3){
  const t=tint.map(v=>v.toFixed(3)).join(',');
  m.onBeforeCompile=sh=>{
    sh.fragmentShader=sh.fragmentShader.replace('#include <lights_physical_pars_fragment>',
      THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;',
      `float wNL=saturate((dot(geometry.normal,directLight.direction)+${wrap.toFixed(3)})/(1.0+${wrap.toFixed(3)})); vec3 irradiance=mix(wNL*vec3(${t}),vec3(dotNL),smoothstep(0.0,0.55,dotNL))*directLight.color;`));
  };
  m.customProgramCacheKey=()=>'skin'+t+wrap;
  return m;
}
/* ---- shared character textures ---- */
function charTex(){
  if(TEXCACHE._char) return TEXCACHE._char;
  const skinN=texSet('skinN',256,(x,w,h)=>{ x.fillStyle='#808080'; x.fillRect(0,0,w,h); for(let i=0;i<5000;i++){ const v=100+Math.random()*80|0; x.fillStyle=`rgba(${v},${v},${v},.5)`; x.beginPath(); x.arc(Math.random()*w,Math.random()*h,.6+Math.random()*1.2,0,7); x.fill(); } },{strength:1.2});
  const cloth=texSet('cloth',256,(x,w,h)=>{ x.fillStyle='#e8e8e8'; x.fillRect(0,0,w,h); for(let i=0;i<w;i+=3){ x.fillStyle='rgba(255,255,255,.25)'; x.fillRect(i,0,1.5,h); x.fillStyle='rgba(0,0,0,.07)'; x.fillRect(0,i,w,1.5); } for(let i=0;i<1600;i++){ x.fillStyle=`rgba(0,0,0,${Math.random()*.05})`; x.fillRect(Math.random()*w,Math.random()*h,2,2); } blotches(x,w,h,'rgba(0,0,0,A)',8,20,60,.05); },{strength:1.4});
  const denim=texSet('denim',256,(x,w,h)=>{ x.fillStyle='#d8dde6'; x.fillRect(0,0,w,h); for(let j=0;j<h;j+=2){ for(let i=0;i<w;i+=2){ if(((i+j)/2)%3===0){ x.fillStyle='rgba(20,30,60,.22)'; x.fillRect(i,j,2,2); } } } for(let i=0;i<220;i++){ x.fillStyle=`rgba(255,255,255,${Math.random()*.12})`; x.fillRect(Math.random()*w,Math.random()*h,1,6+Math.random()*10); } },{strength:1.6});
  const hair=texSet('hairT2',[256,256],(x,w,h)=>{ x.fillStyle='#8a8a8a'; x.fillRect(0,0,w,h); for(let i=0;i<2600;i++){ const v=Math.random()<.5?200:50; x.strokeStyle=`rgba(${v},${v},${v},${.06+Math.random()*.1})`; x.lineWidth=.5+Math.random()*.6; const px=Math.random()*w, py=Math.random()*h-40; x.beginPath(); x.moveTo(px,py); x.bezierCurveTo(px+rand(-3,3),py+30,px+rand(-3,3),py+60,px+rand(-2,2),py+90); x.stroke(); } },{strength:1.1});
  const rubber=texSet('rubber',128,(x,w,h)=>{ speckle(x,w,h,'#c8c8c8',['#bbb','#d4d4d4'],3000,1); },{strength:.8});
  TEXCACHE._char={skinN,cloth,denim,hair,rubber}; return TEXCACHE._char;
}
/* ---------- head sculpting (direction-space features on a sphere) ---------- */
const _hd=new THREE.Vector3();
function gauss(d,cx,cy,cz,s){ const dx=d.x-cx,dy=d.y-cy,dz=d.z-cz; return Math.exp(-(dx*dx+dy*dy+dz*dz)/(2*s*s)); }
function gauss2(v,c,s){ return Math.exp(-(v-c)*(v-c)/(2*s*s)); }
/* HEAD PARAMS: shape knobs per character */
function headPoint(d,P,m){   // d: unit dir, P: params, m: {open,smile,frown}
  const x=d.x,y=d.y,z=d.z; m=m||{};
  let rx=P.rx, ry=P.ry, rz=P.rz;
  const low=smooth(invLerp(.05,-.95,y));
  rx*=1-P.jaw*low*low; rz*=1-.1*low;
  if(z<0) rz*=1+.07*smooth(-z)*smooth(invLerp(-.5,.4,y));
  if(P.alien){ const up=smooth(invLerp(-.1,.9,y)); rx*=1+.35*up; rz*=1+.28*up; ry*=1+.18*up; rx*=1-.18*low; }
  const p=new THREE.Vector3(x*rx,y*ry,z*rz);
  const front=smooth(invLerp(.35,.95,z));
  p.z-=front*(1-Math.abs(y))*.012*(P.flat||1);    // flatter face plane
  let o=0;   // outward offset
  if(!P.alien){
    o-=.012*(gauss(d,.34,.13,.93,.11)+gauss(d,-.34,.13,.93,.11));                 // eye sockets
    o+=.008*gauss2(y,.3,.07)*Math.exp(-x*x/.18)*front;                          // brow ridge
    o+=.008*(gauss(d,.55,-.02,.82,.13)+gauss(d,-.55,-.02,.82,.13))*(P.cheek||1);   // cheekbones
    o-=.004*(gauss(d,.5,-.35,.8,.12)+gauss(d,-.5,-.35,.8,.12));                  // cheek hollows
    o+=.006*(gauss(d,.66,-.55,.35,.16)+gauss(d,-.66,-.55,.35,.16));              // jaw angle
    o+=.013*gauss(d,0,-.74,.66,.15)*(P.chin||1);                               // chin
    o-=.003*gauss2(x,0,.05)*gauss2(y,-.27,.05)*front;                         // philtrum
    o-=.004*(gauss(d,.8,.28,.35,.14)+gauss(d,-.8,.28,.35,.14));                  // temples
    // nose
    const ny=y, bridge=smooth(invLerp(.3,.08,ny)), tip=gauss2(ny,-.13,.07), under=smooth(invLerp(-.3,-.2,ny));
    const width=lerp(.07,.13,smooth(invLerp(.1,-.14,ny)));
    const prof=(bridge*.016+tip*.034*(P.nose||1))*under;
    o+=prof*Math.exp(-x*x/(2*width*width))*front;
    o+=.008*(gauss(d,.13,-.19,.95,.055)+gauss(d,-.13,-.19,.95,.055))*front;    // nostril wings
    // lips
    const lipW=Math.exp(-x*x/(2*.2*.2));
    o+=.0085*gauss2(y,-.335,.045)*lipW*front*(P.lips||1);
    o+=.0095*gauss2(y,-.445,.05)*Math.exp(-x*x/(2*.18*.18))*front*(P.lips||1);
    o-=.005*gauss2(y,-.392,.014)*Math.exp(-x*x/(2*.24*.24))*front;           // mouth line
    o-=.004*gauss2(y,-.56,.04)*Math.exp(-x*x/.06)*front;                       // under-lip crease
  } else {
    o-=.012*(gauss(d,.38,.02,.9,.16)+gauss(d,-.38,.02,.9,.16));                // big eye sockets
    o+=.004*gauss(d,0,-.5,.85,.12);                                            // tiny mouth ridge
  }
  const n=p.clone().normalize();
  p.addScaledVector(n,o);
  // --- morphs ---
  if(m.open && !P.alien){
    const w=smooth(invLerp(-.37,-.46,y))*smooth(invLerp(-.2,.35,z))*Math.max(0,1-Math.abs(x)*1.4);
    const ang=-.3*m.open*w, hy=-.01, hz=-.02; const py=p.y-hy, pz=p.z-hz;
    p.y=hy+py*Math.cos(ang)-pz*Math.sin(ang); p.z=hz+py*Math.sin(ang)+pz*Math.cos(ang);
    p.y+=.003*m.open*gauss2(y,-.335,.05)*Math.exp(-x*x/.05)*front;
  }
  if(m.smile && !P.alien){ const c=gauss(d,.26,-.4,.9,.1)+gauss(d,-.26,-.4,.9,.1), ck=gauss(d,.45,-.2,.85,.14)+gauss(d,-.45,-.2,.85,.14); p.y+=m.smile*(.011*c+.005*ck); p.x+=m.smile*.006*c*Math.sign(x); p.z-=m.smile*.003*c; }
  if(m.frown && !P.alien){ const c=gauss(d,.26,-.42,.9,.1)+gauss(d,-.26,-.42,.9,.1); p.y-=m.frown*.009*c; }
  return p;
}
function headGeo(P){
  const key='head'+JSON.stringify(P);
  return GC(key,()=>{
    const g=new THREE.SphereGeometry(1,72,54), pos=g.attributes.position, n=pos.count;
    const base=new Float32Array(n*3), mo=new Float32Array(n*3), ms=new Float32Array(n*3), mf=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      _hd.fromBufferAttribute(pos,i).normalize();
      const b=headPoint(_hd,P), o=headPoint(_hd,P,{open:1}), s=headPoint(_hd,P,{smile:1}), f=headPoint(_hd,P,{frown:1});
      base[i*3]=b.x; base[i*3+1]=b.y; base[i*3+2]=b.z;
      mo[i*3]=o.x-b.x; mo[i*3+1]=o.y-b.y; mo[i*3+2]=o.z-b.z;
      ms[i*3]=s.x-b.x; ms[i*3+1]=s.y-b.y; ms[i*3+2]=s.z-b.z;
      mf[i*3]=f.x-b.x; mf[i*3+1]=f.y-b.y; mf[i*3+2]=f.z-b.z;
    }
    pos.array.set(base); pos.needsUpdate=true; g.computeVertexNormals();
    g.morphAttributes.position=[new THREE.BufferAttribute(mo,3),new THREE.BufferAttribute(ms,3),new THREE.BufferAttribute(mf,3)];
    g.morphTargetsRelative=true;
    return g;
  });
}
/* shell grown out of the head surface where mask(d)>0 (hair, beard) */
function shellGeo(P,key,mask,thick,noiseAmt=0,seg=[64,48],morph=false){
  return GC('shell'+key+JSON.stringify(P),()=>{
    const g=new THREE.SphereGeometry(1,seg[0],seg[1]), pos=g.attributes.position, n=pos.count, keep=new Uint8Array(n), mo=morph?new Float32Array(n*3):null;
    for(let i=0;i<n;i++){
      _hd.fromBufferAttribute(pos,i).normalize();
      const k=mask(_hd); const b=headPoint(_hd,P); const nn=b.clone().normalize();
      const nz=noiseAmt?noise2(_hd.x*9+_hd.z*3,_hd.y*9)*noiseAmt:0;
      b.addScaledVector(nn,(thick+nz)*k-.0015*(1-k));
      pos.setXYZ(i,b.x,b.y,b.z); keep[i]=k>.02?1:0;
      if(mo){ const o=headPoint(_hd,P,{open:1}), bb=headPoint(_hd,P); mo[i*3]=o.x-bb.x; mo[i*3+1]=o.y-bb.y; mo[i*3+2]=o.z-bb.z; }
    }
    if(mo){ g.morphAttributes.position=[new THREE.BufferAttribute(mo,3)]; g.morphTargetsRelative=true; }
    const idx=g.index.array, out=[];
    for(let i=0;i<idx.length;i+=3){ if(keep[idx[i]]||keep[idx[i+1]]||keep[idx[i+2]]) out.push(idx[i],idx[i+1],idx[i+2]); }
    g.setIndex(out); g.computeVertexNormals(); return g;
  });
}
/* face colour map painted in the head's UV space */
function faceTex(skin,o={}){
  const key='face'+skin+JSON.stringify(o);
  if(TEXCACHE[key]) return TEXCACHE[key];
  const W=512,H=256, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'), img=x.createImageData(W,H), d=img.data;
  const base=new THREE.Color(skin), lip=new THREE.Color(o.lip||0xb85a5a), blush=new THREE.Color(0xd86a5a), dir=new THREE.Vector3();
  const stub=new THREE.Color(o.stubble||0x3a2a20);
  for(let j=0;j<H;j++) for(let i=0;i<W;i++){
    const phi=i/W*Math.PI*2, th=j/H*Math.PI;
    dir.set(-Math.cos(phi)*Math.sin(th),Math.cos(th),Math.sin(phi)*Math.sin(th));
    const X=dir.x,Y=dir.y,Z=dir.z, front=smooth(invLerp(.35,.95,Z));
    let r=base.r,g=base.g,b=base.b;
    const n=(noise2(i*.08,j*.08)*.5+noise2(i*.3,j*.3)*.25)*.06; r+=n; g+=n*.8; b+=n*.7;
    if(!o.alien){
      const lips=Math.max(gauss2(Y,-.335,.035)*Math.exp(-X*X/(2*.16*.16)),gauss2(Y,-.445,.04)*Math.exp(-X*X/(2*.15*.15)))*front;
      const bl=(gauss(dir,.5,-.18,.84,.13)+gauss(dir,-.5,-.18,.84,.13))*(o.blush||.35);
      const sock=(gauss(dir,.34,.14,.93,.07)+gauss(dir,-.34,.14,.93,.07))*.25;
      r=lerp(r,blush.r,bl*.5); g=lerp(g,blush.g,bl*.5); b=lerp(b,blush.b,bl*.5);
      r=lerp(r,lip.r,clamp(lips*1.4,0,1)); g=lerp(g,lip.g,clamp(lips*1.4,0,1)); b=lerp(b,lip.b,clamp(lips*1.4,0,1));
      r*=1-sock; g*=1-sock*1.1; b*=1-sock*.9;
      if(o.stubbleAmt){ const jaw=smooth(invLerp(-.25,-.55,Y))*smooth(invLerp(-.2,.4,Z))*(1-lips); const sp=Math.random()<.55?1:0; const k=jaw*o.stubbleAmt*sp*.5; r=lerp(r,stub.r,k); g=lerp(g,stub.g,k); b=lerp(b,stub.b,k); }
    } else {
      const sp=(noise2(i*.05,j*.05)>.35)?.12:0; r+=sp*.4; g+=sp*.5; b+=sp*.6;
    }
    const k=(j*W+i)*4; d[k]=clamp(r,0,1)*255; d[k+1]=clamp(g,0,1)*255; d[k+2]=clamp(b,0,1)*255; d[k+3]=255;
  }
  x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAX_ANISO; TEXCACHE[key]=t; return t;
}
function irisTex(hex,alien){
  const key='iris'+hex+(alien?'a':''); if(TEXCACHE[key]) return TEXCACHE[key];
  const t=canvasTex(256,128,(x,w,h)=>{
    x.fillStyle=alien?'#05070a':'#f4efe8'; x.fillRect(0,0,w,h);
    if(!alien) for(let i=0;i<40;i++){ x.strokeStyle=`rgba(200,60,60,${Math.random()*.25})`; x.lineWidth=.5; x.beginPath(); let px=Math.random()*w,py=Math.random()*h; x.moveTo(px,py); for(let k=0;k<5;k++){ px+=rand(-8,8); py+=rand(-6,6); x.lineTo(px,py); } x.stroke(); }
    const cx=w*.25, cy=h*.5, R=alien?40:24;
    const c=new THREE.Color(hex);
    const g=x.createRadialGradient(cx,cy,0,cx,cy,R);
    g.addColorStop(0,'#000'); g.addColorStop(alien?.1:.34,'#000'); g.addColorStop(alien?.12:.38,'#'+c.clone().multiplyScalar(1.4).getHexString());
    g.addColorStop(.8,'#'+c.getHexString()); g.addColorStop(.95,'#'+c.clone().multiplyScalar(.35).getHexString()); g.addColorStop(1,alien?'rgba(0,0,0,0)':'rgba(0,0,0,.0)');
    x.fillStyle=g; x.beginPath(); x.arc(cx,cy,R,0,7); x.fill();
    x.save(); x.translate(cx,cy);
    for(let i=0;i<70;i++){ const a=Math.random()*Math.PI*2; x.strokeStyle=`rgba(255,255,255,${Math.random()*.18})`; x.lineWidth=.8; x.beginPath(); x.moveTo(Math.cos(a)*R*.4,Math.sin(a)*R*.4); x.lineTo(Math.cos(a)*R*.95,Math.sin(a)*R*.95); x.stroke(); }
    x.restore();
  });
  TEXCACHE[key]=t; return t;
}
/* ---------- body profiles (lathe, radius vs height) ---------- */
const TORSO_P=[[0,-.03],[.148,-.03],[.155,.04],[.148,.12],[.145,.2],[.158,.28],[.175,.36],[.183,.42],[.18,.46],[.158,.5],[.118,.53],[.082,.552],[.064,.566],[0,.57]];
const HIPS_P=[[0,-.16],[.09,-.155],[.148,-.11],[.165,-.04],[.162,.02],[.15,.065],[0,.065]];
const UPPER_P=[[0,-.30],[.037,-.29],[.043,-.25],[.048,-.15],[.054,-.06],[.051,-.01],[.03,.02],[0,.025]];
const FORE_P=[[0,-.268],[.027,-.262],[.031,-.2],[.04,-.09],[.043,-.02],[.03,.012],[0,.015]];
const THIGH_P=[[0,-.455],[.053,-.445],[.06,-.38],[.074,-.2],[.084,-.07],[.08,0],[.05,.03],[0,.035]];
const SHIN_P=[[0,-.43],[.035,-.42],[.039,-.34],[.055,-.17],[.057,-.06],[.054,0],[0,.02]];
function lathe(key,pts,seg=20,zs=1,xs=1){ return GC('lathe'+key+seg+zs+xs,()=>{ const g=new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg); if(zs!==1||xs!==1) g.scale(xs,1,zs); g.computeVertexNormals(); return g; }); }
function scaleP(P,k,kz){ return P.map(p=>[p[0]*k,p[1]]); }
/* hand with articulated fingers (3 joints each, nails, a real palm with thickness): returns {grp, fingers:[{a,b,c}], thumb, thumb2} */
function handSeg(parent,len,r0,r1,skinM){
  const m=mesh(GC('hseg'+len+'_'+r0+'_'+r1,()=>{ const c=new THREE.CylinderGeometry(r0,r1,len,10); c.translate(0,-len/2,0); return c; }),skinM,0,0,0,false); parent.add(m);
  parent.add(mesh(GC('hjoint'+r0,()=>new THREE.SphereGeometry(r0*1.02,10,8)),skinM,0,0,0,false)); return m;
}
function makeHand(side,skinM){
  const grp=new THREE.Group(), s=side*-1;
  const ell=(key,sx,sy,sz,x,y,z)=>{ const m=mesh(GC(key,()=>{ const g=new THREE.SphereGeometry(1,16,12); g.scale(sx,sy,sz); return g; }),skinM,x,y,z,false); grp.add(m); return m; };
  // palm: thick in the middle and rounded, with the knuckle pads and the thumb muscle
  grp.add(mesh(roundedBoxGeo(.076,.08,.026,.012),skinM,0,-.045,0));
  ell('hBack',.038,.041,.012,0,-.047,-.008);
  ell('hFront',.035,.038,.011,0,-.045,.007);
  ell('hPads',.037,.013,.012,0,-.081,.002);
  const th0=ell('hThenar',.017,.026,.015,.022*s,-.032,.009); th0.rotation.z=.45*s;
  const nailM=new THREE.MeshPhysicalMaterial({color:(skinM.color?skinM.color.clone():col(0xe8b894)).lerp(col(0xffeee6),.45),roughness:.28,clearcoat:.6,clearcoatRoughness:.3});
  const fingers=[];
  const P=[.043,.048,.045,.036], M=[.026,.03,.028,.022], D=[.021,.023,.022,.018], R=[.0091,.0095,.009,.0079];
  for(let i=0;i<4;i++){
    const r=R[i];
    const a=new THREE.Group(); a.position.set((-.0283+i*.0189)*s,-.084,.001); a.rotation.z=(i-1.5)*.035*s; grp.add(a);
    handSeg(a,P[i],r,r*.94,skinM);
    const b=new THREE.Group(); b.position.y=-P[i]; a.add(b); handSeg(b,M[i],r*.94,r*.87,skinM);
    const c=new THREE.Group(); c.position.y=-M[i]; b.add(c); handSeg(c,D[i],r*.87,r*.8,skinM);
    c.add(mesh(GC('htip'+r,()=>new THREE.SphereGeometry(r*.8,10,8)),skinM,0,-D[i],0,false));
    const nail=mesh(GC('hnail'+i,()=>{ const g=new THREE.SphereGeometry(1,12,8); g.scale(r*.74,D[i]*.36,r*.3); return g; }),nailM,0,-D[i]*.6,-r*.62,false); c.add(nail);
    fingers.push({a,b,c});
  }
  const th=new THREE.Group(); th.position.set(.034*s,-.028,.013); th.rotation.z=.62*s; th.rotation.y=-.35*s; grp.add(th);
  handSeg(th,.036,.0108,.0098,skinM);
  const th2=new THREE.Group(); th2.position.y=-.036; th.add(th2); handSeg(th2,.03,.0098,.0086,skinM);
  th2.add(mesh(GC('ttip2',()=>new THREE.SphereGeometry(.0086,10,8)),skinM,0,-.03,0,false));
  const tn=mesh(GC('tnail2',()=>{ const g=new THREE.SphereGeometry(1,12,8); g.scale(.0068,.012,.0032); return g; }),nailM,0,-.019,-.0066,false); th2.add(tn);
  return {grp,fingers,thumb:th,thumb2:th2};
}
function shoeGeo(){ return GC('shoe4',()=>{ const parts=[]; const s=new THREE.SphereGeometry(.5,16,10); const a=s.clone(); a.scale(.105,.085,.255); a.translate(0,-.018,.04); parts.push(a); const sole=new THREE.BoxGeometry(.11,.024,.28); sole.translate(0,-.052,.035); parts.push(sole); const toe=new THREE.SphereGeometry(.5,12,8); toe.scale(.1,.05,.1); toe.translate(0,-.035,.14); parts.push(toe); return mergeGeos(parts); }); }

/* ---------- the builder ---------- */
function makeHuman(o={}){
  const T=charTex();
  const opt=Object.assign({skin:0xe8b894,shirt:0x3b6ea5,pants:0x3a4a6a,shoes:0x2a2522,hair:0x3b2a1a,hairStyle:'short',beard:false,eye:0x4a3020,
    build:1,height:1,name:'?',voice:'Jim',sleeves:'short',alien:false,accent:0x7dffe8,denim:true,head:{},collar:true,apron:null,hood:false},o);
  const g=new THREE.Group(); g.name=opt.name;
  const skinM=skinify(new THREE.MeshPhysicalMaterial({color:col(opt.skin),roughness:opt.alien?.35:.52,normalMap:T.skinN.normalMap,normalScale:new THREE.Vector2(.35,.35),clearcoat:opt.alien?.3:0,clearcoatRoughness:.4,emissive:col(opt.skin),emissiveIntensity:opt.skinGlow||0}),opt.sss||(opt.alien?[.4,.8,1]:[1,.66,.56]));
  const shirtM=opt.alien?new THREE.MeshPhysicalMaterial({color:col(opt.shirt),roughness:.35,metalness:.4,clearcoat:.6,clearcoatRoughness:.2}):new THREE.MeshPhysicalMaterial({color:col(opt.shirt),roughness:.88,map:T.cloth.map,normalMap:T.cloth.normalMap,normalScale:new THREE.Vector2(.6,.6),sheen:col(0x222222)});
  const pantsM=opt.alien?new THREE.MeshPhysicalMaterial({color:col(opt.pants),roughness:.4,metalness:.3,clearcoat:.4}):new THREE.MeshPhysicalMaterial({color:col(opt.pants),roughness:.9,map:opt.denim?T.denim.map:T.cloth.map,normalMap:opt.denim?T.denim.normalMap:T.cloth.normalMap,normalScale:new THREE.Vector2(.8,.8),sheen:col(0x1a1a1a)});
  const shoeM=new THREE.MeshStandardMaterial({color:col(opt.shoes),roughness:.55,normalMap:T.rubber.normalMap});
  const soleM=mat(0xe8e4dc,{roughness:.8});
  const hrep=repeatSet(T.hair,5,3); const hairM=new THREE.MeshPhysicalMaterial({color:col(opt.hair),roughness:.5,map:hrep.map,normalMap:hrep.normalMap,normalScale:new THREE.Vector2(.7,.7),sheen:col(shadeHex(opt.hair,.7))});
  const glowM=opt.alien?new THREE.MeshStandardMaterial({color:col(opt.accent),emissive:col(opt.accent),emissiveIntensity:2.2,roughness:.3}):null;
  const bw=opt.build;
  const J={}; // joints
  // --- legs ---
  function leg(side){
    const hip=new THREE.Group(); hip.position.set(side*.092,.92,0); g.add(hip);
    hip.add(mesh(lathe('thigh'+bw,scaleP(THIGH_P,bw),16),pantsM));
    const knee=new THREE.Group(); knee.position.y=-.445; hip.add(knee);
    knee.add(mesh(lathe('shin',SHIN_P,16),pantsM));
    knee.add(mesh(GC('kneeS',()=>new THREE.SphereGeometry(.052,12,8)),pantsM,0,0,.004));
    if(!opt.alien){ const cuff=mesh(GC('cuff',()=>new THREE.CylinderGeometry(.056,.06,.05,16,1,true)),pantsM,0,-.39,0,false); knee.add(cuff); }
    const foot=new THREE.Group(); foot.position.y=-.43; knee.add(foot);
    foot.add(mesh(shoeGeo(),shoeM)); foot.add(mesh(GC('sole4',()=>{ const b=new THREE.BoxGeometry(.112,.018,.285); b.translate(0,-.058,.035); return b; }),soleM,0,0,0,false));
    return {hip,knee,foot};
  }
  const LL=leg(1), RL=leg(-1);
  J.thL=LL.hip; J.knL=LL.knee; J.ftL=LL.foot; J.thR=RL.hip; J.knR=RL.knee; J.ftR=RL.foot;
  // --- spine / torso ---
  const hips=new THREE.Group(); hips.position.y=.92; g.add(hips); J.hips=hips;
  hips.add(mesh(lathe('hips',HIPS_P,20,.74),pantsM));
  if(!opt.alien){ hips.add(mesh(GC('belt4',()=>{ const c=new THREE.CylinderGeometry(.157,.157,.036,24,1,true); c.scale(1,1,.75); return c; }),mat(0x2b1d12,{roughness:.45}),0,.05,0,false));
    hips.add(mesh(GC('buckle4',()=>new THREE.BoxGeometry(.04,.03,.01)),mat(0xc9a54a,{metalness:.9,roughness:.25}),0,.05,.118,false)); }
  const spine=new THREE.Group(); spine.position.y=.02; hips.add(spine); J.spine=spine;
  const chest=new THREE.Group(); chest.position.y=.04; spine.add(chest); J.chest=chest;
  const torso=mesh(lathe('torso'+bw,TORSO_P.map(p=>[p[0]*(p[1]>.25?bw:1),p[1]]),28,.62),shirtM); chest.add(torso);
  if(!opt.alien && opt.collar){
    const col1=mesh(GC('collarL',()=>{ const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(.07,-.02); s.lineTo(.05,-.075); s.closePath(); return new THREE.ExtrudeGeometry(s,{depth:.006,bevelEnabled:false}); }),shirtM,0,0,0,false);
    for(const sd of [-1,1]){ const cc=col1.clone(); cc.position.set(sd*.012,.535,.07); cc.rotation.set(-.35,sd>0?0:Math.PI,sd*.1); if(sd<0){ cc.scale.x=1; } chest.add(cc); }
    for(let i=0;i<4;i++){ const bt=mesh(GC('btn4',()=>new THREE.CylinderGeometry(.006,.006,.004,10)),mat(0xf2ede0,{roughness:.3}),0,.44-i*.1,.106+(i<2?.004:0),false); bt.rotation.x=Math.PI/2; chest.add(bt); }
    chest.add(mesh(GC('placket',()=>new THREE.BoxGeometry(.024,.46,.004)),shirtM,0,.24,.1,false));
    const pk=mesh(GC('pocket',()=>new THREE.BoxGeometry(.07,.08,.006)),shirtM,.075,.34,.098,false); pk.rotation.y=.25; chest.add(pk);
  }
  if(opt.hood){ const hd=mesh(GC('hoodie',()=>{ const t=new THREE.TorusGeometry(.1,.04,10,20); t.scale(1,.8,1); return t; }),shirtM,0,.5,-.03,false); hd.rotation.x=Math.PI/2+.4; chest.add(hd);
    for(const sd of [-1,1]) chest.add(mesh(GC('string',()=>new THREE.CylinderGeometry(.003,.003,.14,5)),mat(0xeeeeee),sd*.03,.4,.105,false)); }
  if(opt.apron){ const ap=mesh(GC('apron',()=>{ const s=new THREE.Shape(); s.moveTo(-.12,.46); s.lineTo(.12,.46); s.lineTo(.17,.1); s.lineTo(.18,-.42); s.lineTo(-.18,-.42); s.lineTo(-.17,.1); s.closePath(); return new THREE.ExtrudeGeometry(s,{depth:.004,bevelEnabled:false}); }),new THREE.MeshStandardMaterial({color:col(opt.apron),roughness:.8,map:T.cloth.map}),0,0,.112,false); chest.add(ap); J.apron=ap; }
  if(opt.alien){ chest.add(mesh(GC('aEmb',()=>new THREE.CircleGeometry(.035,20)),glowM,0,.32,.113,false)); chest.add(mesh(GC('aSeam',()=>new THREE.BoxGeometry(.008,.3,.004)),glowM,0,.12,.109,false)); }
  const neck=mesh(GC('neck5',()=>new THREE.CylinderGeometry(.056,.064,.12,18)),skinM,0,.57,-.008); chest.add(neck);
  // --- head ---
  const headJ=new THREE.Group(); headJ.position.set(0,.6,.005); headJ.scale.setScalar(1.08); chest.add(headJ); J.head=headJ;  // a touch bigger: the old heads looked tiny on the body
  const HP=Object.assign({rx:.074,ry:.104,rz:.093,jaw:.3,alien:opt.alien},opt.head);
  if(opt.alien) Object.assign(HP,{rx:.072,ry:.11,rz:.09,jaw:.45});
  const faceM=skinify(new THREE.MeshPhysicalMaterial({color:0xffffff,map:faceTex(opt.skin,{stubbleAmt:opt.beard?0:(opt.stubble||0),alien:opt.alien,blush:opt.blush,lip:opt.lip}),normalMap:T.skinN.normalMap,normalScale:new THREE.Vector2(.3,.3),roughness:opt.alien?.3:.55,clearcoat:opt.alien?.4:0,clearcoatRoughness:.35,morphTargets:true}),opt.alien?[.4,.8,1]:[1,.46,.36]);
  const head=mesh(headGeo(HP),faceM,0,.11,0); headJ.add(head);
  head.morphTargetInfluences=[0,0,0];
  const HPt=(x,y,z,out=0)=>{ const d=V3(x,y,z).normalize(); const q=headPoint(d,HP); return q.addScaledVector(q.clone().normalize(),out); };
  // mouth interior + teeth (hidden behind the lips until the jaw opens)
  if(!opt.alien){
    const mp=HPt(0,-.39,.92);
    head.add(mesh(GC('cavity2',()=>{ const s=new THREE.SphereGeometry(.024,14,10); s.scale(.8,.6,.7); return s; }),mat(0x3a0e12,{roughness:.6}),0,mp.y,mp.z-.027,false));  // narrower + further back: it poked out at the mouth corners
    head.add(mesh(GC('teethU',()=>{ const t=new THREE.TorusGeometry(.02,.0038,6,16,Math.PI); t.rotateX(Math.PI/2); t.rotateY(Math.PI); t.scale(1,1.3,.7); return t; }),mat(0xf0ebe0,{roughness:.25}),0,mp.y+.004,mp.z-.021,false));
    const jawG=new THREE.Group(); jawG.position.set(0,-.01,-.02); head.add(jawG);
    jawG.add(mesh(GC('teethL',()=>{ const t=new THREE.TorusGeometry(.018,.0034,6,16,Math.PI); t.rotateX(Math.PI/2); t.rotateY(Math.PI); t.scale(1,1.2,.7); return t; }),mat(0xeee8dc,{roughness:.3}),0,mp.y+.004,mp.z-.001,false));
    J.jaw=jawG;
  }
  // eyes (placed in the sculpted sockets), lids, lashes, brows
  const eyes=[], lids=[], lidsLo=[], brows=[];
  const eyeM=new THREE.MeshPhysicalMaterial({map:irisTex(opt.alien?opt.accent:opt.eye,opt.alien),roughness:.25,clearcoat:1,clearcoatRoughness:.02});
  for(const sd of [1,-1]){
    const sp=opt.alien?HPt(.38*sd,.02,.9):HPt(.34*sd,.13,.93);
    const c=sp.clone().addScaledVector(sp.clone().normalize(),opt.alien?-.012:-.0075);
    const eg=new THREE.Group(); eg.position.copy(c); head.add(eg); eg.scale.setScalar(1.14);
    if(opt.alien){ eg.scale.set(1.7,1.25,1.1); eg.rotation.z=sd*.35; }
    const ball=mesh(GC('eyeball4',()=>new THREE.SphereGeometry(.0118,24,16)),eyeM,0,0,0,false); eg.add(ball);
    const lidU=mesh(GC('lidU4',()=>{ const s=new THREE.SphereGeometry(.0127,20,8,0,Math.PI*2,0,Math.PI*.5); return s; }),faceM,0,0,0,false); lidU.rotation.x=-.5; eg.add(lidU);
    const lidL=mesh(GC('lidL4',()=>{ const s=new THREE.SphereGeometry(.0125,20,8,0,Math.PI*2,Math.PI*.5,Math.PI*.5); return s; }),faceM,0,0,0,false); lidL.rotation.x=.6; eg.add(lidL);
    if(!opt.alien){ const lash=mesh(GC('lash4',()=>{ const t=new THREE.TorusGeometry(.0128,.0009,4,16,Math.PI); t.rotateX(-Math.PI/2); t.rotateY(Math.PI); return t; }),mat(0x120c08,{roughness:.8}),0,0,0,false); lidU.add(lash); }
    eyes.push(ball); lids.push(lidU); lidsLo.push(lidL);
    if(!opt.alien){
      const bp=HPt(.33*sd,.34,.9,.0035);
      const br=mesh(GC('brow4'+(opt.browThick||0),()=>{ const cc=new THREE.CatmullRomCurve3([V3(-.019,-.003,-.002),V3(-.006,.003,.002),V3(.01,.003,.001),V3(.021,-.004,-.006)]); return new THREE.TubeGeometry(cc,12,opt.browThick||.0032,5,false); }),hairM,bp.x,bp.y,bp.z,false);
      br.rotation.y=sd*.32; if(sd<0) br.scale.x=-1; br.userData.base={y:bp.y}; head.add(br); brows.push(br);
    }
  }
  // ears
  if(!opt.alien) for(const sd of [1,-1]){
    const ep=HPt(sd,-.06,-.08);
    const ear=new THREE.Group(); ear.position.copy(ep); ear.rotation.y=sd*.3; head.add(ear);
    ear.add(mesh(GC('ear4',()=>{ const s=new THREE.SphereGeometry(1,16,12); s.scale(.009,.029,.018); return s; }),skinM,sd*.004,0,0,false));
    ear.add(mesh(GC('earIn',()=>{ const s=new THREE.SphereGeometry(1,12,8); s.scale(.0045,.017,.01); return s; }),mat(shadeHex(opt.skin,.62),{roughness:.6}),sd*.0105,.002,.002,false));
  } else {
    for(const sd of [1,-1]){ const st=new THREE.Group(); const ap=HPt(.3*sd,.9,.1); st.position.copy(ap); st.rotation.z=-sd*.45; head.add(st);
      st.add(mesh(GC('antS',()=>new THREE.CylinderGeometry(.0035,.006,.12,6)),skinM,0,.06,0,false)); st.add(mesh(GC('antB',()=>new THREE.SphereGeometry(.012,10,8)),glowM,0,.125,0,false)); (J.antennae=J.antennae||[]).push(st); }
  }
  // hair: a shell grown from the scalp above a hairline, plus clumped spikes for Jim
  if(opt.hairStyle!=='bald' && !opt.alien){
    const HL=[[0,.46],[.75,.36],[1.25,.14],[1.7,.02],[2.3,-.22],[Math.PI,-.42]];
    const hairline=a=>{ a=Math.abs(a); for(let i=1;i<HL.length;i++){ if(a<=HL[i][0]){ const k=(a-HL[i-1][0])/(HL[i][0]-HL[i-1][0]); return lerp(HL[i-1][1],HL[i][1],smooth(k)); } } return HL[HL.length-1][1]; };
    const hairMask=d=>{ const a=Math.atan2(d.x,d.z); let k=smooth((d.y-hairline(a))/.07); const ear=Math.abs(d.x)>.8&&d.y>-.3&&d.y<.18&&d.z>-.35&&d.z<.2; if(ear) k*=smooth((d.y-.18)/.05); return clamp(k,0,1); };
    const cap=mesh(shellGeo(HP,'cap'+opt.hairStyle,hairMask,opt.hairStyle==='spiky'?.011:.008,.0025),hairM,0,.11,0,true); headJ.add(cap);
    if(opt.hairStyle==='spiky'){
      const r=RNG(opt.seed||11);
      for(let i=0;i<46;i++){
        const a=(r()-.5)*Math.PI*1.9, el=.35+r()*1.1; const d=V3(Math.sin(a)*Math.cos(el),Math.sin(el),Math.cos(a)*Math.cos(el));
        if(hairMask(d)<.8) continue;
        const p=headPoint(d,HP); const len=.028+r()*.03;
        const sp=mesh(GC('spike4',()=>{ const c=new THREE.ConeGeometry(.013,1,7); c.translate(0,.5,0); return c; }),hairM,p.x,p.y+.11,p.z,false);
        sp.scale.set(1+r()*.6,len,1+r()*.6);
        const dir=d.clone().multiplyScalar(.8).add(V3(rand(-.25,.25),.7,-.15+rand(-.2,.2))).normalize();
        sp.quaternion.setFromUnitVectors(V3(0,1,0),dir);
        headJ.add(sp);
      }
    }
  }
  J.morphShells=[];
  if(opt.beard && !opt.alien){
    const beardM=hairM.clone(); beardM.morphTargets=true;
    const bm=d=>{ const a=Math.atan2(d.x,d.z); const yb=lerp(-.2,-.02,smooth((Math.abs(a)-.5)/.9)); let k=smooth((yb-d.y)/.09)*smooth((1.6-Math.abs(a))/.15); const lip=Math.exp(-d.x*d.x/(2*.2*.2))*smooth((d.y+.52)/.05)*smooth((-.3-d.y)/.05); k*=1-lip; return clamp(k,0,1); };
    const bmesh=mesh(shellGeo(HP,'beard2',bm,.0085,.005,[72,54],true),beardM,0,.11,0,false); headJ.add(bmesh); bmesh.morphTargetInfluences=[0]; J.morphShells.push(bmesh);
    const mm=d=>{ const k=Math.exp(-(d.y+.285)*(d.y+.285)/(2*.03*.03))*Math.exp(-d.x*d.x/(2*.23*.23))*smooth((d.z-.7)/.1); return clamp(k*1.5,0,1); };
    const mmesh=mesh(shellGeo(HP,'mous',mm,.008,.002,[64,48],true),beardM,0,.11,0,false); headJ.add(mmesh); mmesh.morphTargetInfluences=[0]; J.morphShells.push(mmesh);
  }
  // --- arms ---
  function arm(side){
    const sh=new THREE.Group(); sh.position.set(side*.2*bw,.45,0); chest.add(sh);
    const sleeveM=shirtM, longS=opt.sleeves==='long'||opt.alien;
    sh.add(mesh(GC('shoulder6'+side+bw,()=>{ const s=new THREE.SphereGeometry(.055*bw,16,12); s.scale(1,.78,1.08); s.translate(-side*.022,-.004,0); return s; }),sleeveM,0,0,0));
    if(longS) sh.add(mesh(lathe('upper',UPPER_P,14),sleeveM));
    else { sh.add(mesh(lathe('upperS',UPPER_P,14),skinM)); sh.add(mesh(GC('sleeve4',()=>{ const c=new THREE.CylinderGeometry(.056,.066,.15,16,1,true); c.translate(0,-.06,0); return c; }),sleeveM,0,0,0)); }
    const el=new THREE.Group(); el.position.y=-.295; sh.add(el);
    const foreM=longS?sleeveM:skinM;
    el.add(mesh(GC('elbow4',()=>new THREE.SphereGeometry(.042,12,10)),foreM,0,0,0));
    el.add(mesh(lathe('fore',FORE_P,14),foreM));
    if(longS){ el.add(mesh(GC('wrist4',()=>new THREE.CylinderGeometry(.026,.028,.04,12)),skinM,0,-.262,0,false)); }
    if(opt.alien){ const cuff=mesh(GC('aCuff',()=>new THREE.TorusGeometry(.03,.006,6,16)),glowM,0,-.245,0,false); cuff.rotation.x=Math.PI/2; el.add(cuff); }
    const hand=new THREE.Group(); hand.position.y=-.27; el.add(hand);
    const H=makeHand(side,skinM); hand.add(H.grp);
    const hold=new THREE.Group(); hold.position.set(0,-.085,.02); hand.add(hold);
    return {sh,el,hand,H,hold};
  }
  const LA=arm(1), RA=arm(-1);
  J.shL=LA.sh; J.elL=LA.el; J.hdL=LA.hand; J.shR=RA.sh; J.elR=RA.el; J.hdR=RA.hand;
  g.userData={J,opt,head,headJ,eyes,lids,lidsLo,brows,hands:{L:LA,R:RA},holdL:LA.hold,holdR:RA.hold,name:opt.name,voice:opt.voice,
    mats:{skinM,shirtM,pantsM,hairM,faceM},
    A:{walkPhase:Math.random()*6,speed:0,lastPos:new THREE.Vector3(),pose:null,poseW:0,poseTarget:0,poseT:0,poseFade:.35,
      look:null,lookW:0,autoLook:true,yawCur:0,pitchCur:0,sacc:[0,0],saccT:0,blinkT:rand(1,4),blink:0,mood:'neutral',moodK:{smile:0,frown:0,brow:0,browTilt:0,lid:0},
      talk:false,talkT:0,mouth:0,mouthTarget:0,breath:Math.random()*6,gestT:rand(3,8),gest:null,seated:false,dead:false,custom:null,idleOff:false,faceYaw:null,phase:Math.random()*10}};
  g.scale.setScalar(opt.height);
  g.traverse(m=>{ if(m.isMesh){ m.castShadow=m.castShadow!==false; } });
  HUMANS.push(g);
  setMood(g,opt.mood||'neutral');
  return g;
}
function shadeHex(hex,k){ const c=new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); }
function setMood(h,mood){ const A=h.userData.A; A.mood=mood;
  A.moodK={neutral:{smile:0,frown:0,brow:0,browTilt:0,lid:0},happy:{smile:.8,frown:0,brow:.003,browTilt:-.05,lid:.08},sad:{smile:0,frown:.7,brow:.002,browTilt:.35,lid:.2},angry:{smile:0,frown:.4,brow:-.004,browTilt:-.4,lid:.15},shock:{smile:0,frown:.2,brow:.008,browTilt:.1,lid:-.25},worried:{smile:0,frown:.35,brow:.004,browTilt:.3,lid:0},smirk:{smile:.45,frown:0,brow:.001,browTilt:-.15,lid:.12},tired:{smile:0,frown:.25,brow:-.002,browTilt:.25,lid:.55},asleep:{smile:0,frown:.05,brow:-.003,browTilt:.1,lid:1.1},evil:{smile:.55,frown:0,brow:-.005,browTilt:-.5,lid:.2}}[mood]||{smile:0,frown:0,brow:0,browTilt:0,lid:0};
}
/* ---------- poses (absolute joint rotations, blended over the procedural base) ---------- */
const POSES={
  talk:(t,h)=>{ const s=Math.sin(t*2.1+h.userData.A.phase), c=Math.cos(t*1.7+h.userData.A.phase); return {shR:[-.2+s*.08,.1,-.14],elR:[-.65+c*.15,0,0],shL:[-.08+c*.05,0,.1],elL:[-.35+s*.1,0,0],hdR:[0,.9,0]}; },
  point:()=>({shR:[-1.45,.25,-.1],elR:[-.1,0,0],hdR:[0,0,0],fR:.9}),
  pointL:()=>({shL:[-1.45,-.25,.1],elL:[-.1,0,0],fL:.9}),
  wave:(t)=>({shR:[-.3,0,-2.5],elR:[-.2,0,Math.sin(t*9)*.45-.2],hdR:[0,-1.2,0]}),
  armsCrossed:()=>({shL:[-.35,-.3,.35],elL:[-1.9,.2,0],shR:[-.4,.3,-.35],elR:[-1.9,-.2,0]}),
  hips:()=>({shL:[.1,0,.5],elL:[-1.5,.5,0],shR:[.1,0,-.5],elR:[-1.5,-.5,0]}),
  shrug:()=>({shL:[-.2,0,.35],elL:[-1.4,.8,0],shR:[-.2,0,-.35],elR:[-1.4,-.8,0],head:[0,0,.18]}),
  think:()=>({shR:[-.6,.2,-.2],elR:[-2.2,0,0],hdR:[.3,0,0],head:[.12,.2,0]}),
  holdOut:()=>({shR:[-1.25,.1,-.05],elR:[-.25,0,0],hdR:[0,-1.5,0]}),
  holdBoth:()=>({shL:[-1,0,.12],elL:[-.7,0,0],shR:[-1,0,-.12],elR:[-.7,0,0],hdL:[0,1.2,0],hdR:[0,-1.2,0]}),
  carry:()=>({shL:[-.55,0,.25],elL:[-1.2,.3,0],shR:[-.55,0,-.25],elR:[-1.2,-.3,0]}),
  type:(t)=>({shR:[-.9,.2,-.1],elR:[-.55,0,0],hdR:[-.5,0,0],fR:.6+Math.max(0,Math.sin(t*14))*.3,head:[.25,0,0],spine:[.12,0,0]}),
  wrench:(t)=>{ const s=Math.sin(t*5.5); return {shR:[-1.25+s*.08,.2,-.12],elR:[-.55,0,0],hdR:[0,s*.9,0],fR:1,shL:[-1.0,-.15,.25],elL:[-.45,0,0],fL:.85,head:[.18,0,0],spine:[.08,0,0]}; },
  press:()=>({shR:[-1.2,.15,-.05],elR:[-.3,0,0],hdR:[-.4,0,0],fR:1,head:[.2,0,0],spine:[.1,0,0]}),
  climb:(t)=>{ const s=Math.sin(t*3.2); return {shL:[-2.6+s*.3,0,.2],elL:[-.5-s*.3,0,0],shR:[-2.6-s*.3,0,-.2],elR:[-.5+s*.3,0,0],thL:[-.9+s*.5,0,0],knL:[1.2-s*.4,0,0],thR:[-.9-s*.5,0,0],knR:[1.2+s*.4,0,0],fL:.8,fR:.8}; },
  sit:()=>({thL:[-1.5,0,-.05],thR:[-1.5,0,.05],knL:[1.5,0,0],knR:[1.5,0,0],ftL:[.05,0,0],ftR:[.05,0,0],spine:[-.08,0,0]}),
  ride:()=>({thL:[-1.35,0,-.1],thR:[-1.35,0,.1],knL:[1.25,0,0],knR:[1.25,0,0],shL:[-.35,0,.12],elL:[-.95,0,0],shR:[-.35,0,-.12],elR:[-.95,0,0],hdL:[0,.3,0],hdR:[0,-.3,0],fL:.5,fR:.5,spine:[-.12,0,0]}),
  drive:()=>({thL:[-1.35,0,-.08],thR:[-1.35,0,.08],knL:[1.25,0,0],knR:[1.25,0,0],shL:[-1.1,0,.2],elL:[-.6,0,0],shR:[-1.1,0,-.2],elR:[-.6,0,0],fL:.8,fR:.8,spine:[-.15,0,0]}),
  eat:(t)=>{ const k=Math.max(0,Math.sin(t*3)); return {shR:[-.6-k*.9,.2,-.2],elR:[-1.4-k*.6,0,0],shL:[-.6,-.1,.15],elL:[-1.3,0,0],hdL:[0,1.2,0],head:[.15-k*.1,0,0]}; },
  lookDown:()=>({head:[.5,0,0],spine:[.15,0,0]}),
  headShake:(t)=>({head:[.1,Math.sin(t*14)*.4,0]}),
  nod:(t)=>({head:[Math.sin(t*9)*.18+.05,0,0]}),
  facepalm:()=>({shR:[-1.1,.3,-.3],elR:[-2.3,0,0],hdR:[.4,0,0],head:[.3,0,0]}),
  cheer:(t)=>({shL:[-.2,0,2.6+Math.sin(t*8)*.2],shR:[-.2,0,-2.6-Math.sin(t*8)*.2],elL:[-.2,0,0],elR:[-.2,0,0]}),
  stir:(t)=>({shR:[-1.0+Math.sin(t*4)*.15,.3+Math.cos(t*4)*.2,-.1],elR:[-.8,0,0],fR:.9,shL:[-.3,0,.2],elL:[-.8,0,0]}),
  dead:()=>({}),
  sleepCounter:(t)=>{ const b=Math.sin(t*1.1)*.03; return {spine:[.55+b,0,0],chest:[.25,0,0],head:[.55+b,0,.25],shL:[-1.25,0,.35],elL:[-1.6,.4,0],shR:[-1.25,0,-.35],elR:[-1.6,-.4,0],hdL:[0,.6,0],hdR:[0,-.6,0]}; },
  droop:(t)=>({head:[.3+Math.sin(t*.7)*.08,0,.12],spine:[.12,0,0],shL:[.05,0,.08],shR:[.05,0,-.08]}),
  startle:(t)=>({shL:[-.9,0,1.2],elL:[-.6,0,0],shR:[-.9,0,-1.2],elR:[-.6,0,0],head:[-.2,0,0],spine:[-.15,0,0]}),
  sitEat:(t)=>{ const k=Math.max(0,Math.sin(t*2.2)); return {thL:[-1.5,0,-.05],thR:[-1.5,0,.05],knL:[1.5,0,0],knR:[1.5,0,0],spine:[.05,0,0],shR:[-.7-k*.8,.15,-.2],elR:[-1.5-k*.5,0,0],hdR:[0,-.4,0],shL:[-.5,0,.2],elL:[-1.1,0,0],head:[.12-k*.12,0,0]}; },
  sitGive:()=>({thL:[-1.5,0,-.05],thR:[-1.5,0,.05],knL:[1.5,0,0],knR:[1.5,0,0],shR:[-1.25,.1,-.05],elR:[-.25,0,0],hdR:[0,-1.5,0],shL:[-.5,0,.2],elL:[-1.1,0,0]}),
  sitCry:(t)=>({thL:[-1.5,0,-.05],thR:[-1.5,0,.05],knL:[1.5,0,0],knR:[1.5,0,0],spine:[.35,0,0],head:[.45+Math.sin(t*9)*.04,0,0],shL:[-1.1,-.2,.3],elL:[-2.2,.2,0],shR:[-1.1,.2,-.3],elR:[-2.2,-.2,0],hdL:[.4,0,0],hdR:[.4,0,0]}),
  push:()=>({shL:[-1.45,-.1,.1],elL:[-.15,0,0],shR:[-1.45,.1,-.1],elR:[-.15,0,0],hdL:[-1.2,0,0],hdR:[-1.2,0,0],spine:[.18,0,0]}),
  sitGround:(t)=>({thL:[-1.45,0,-.25],thR:[-1.45,0,.25],knL:[.4,0,0],knR:[.4,0,0],spine:[.25,0,0],head:[.35,0,0],shL:[-.4,0,.3],elL:[-.8,0,0],shR:[-.4,0,-.3],elR:[-.8,0,0]}),
  laugh:(t)=>({spine:[-.1+Math.sin(t*14)*.05,0,0],head:[-.25+Math.sin(t*14)*.08,0,0],shL:[-.2,0,.3],elL:[-1.6,0,0],shR:[-.2,0,-.3],elR:[-1.6,0,0]}),
  lieDown:()=>({}),
  sitTalk:(t,h)=>{ const s=Math.sin(t*2.1+h.userData.A.phase); return {thL:[-1.5,0,-.05],thR:[-1.5,0,.05],knL:[1.5,0,0],knR:[1.5,0,0],spine:[-.02,0,0],shR:[-.45+s*.12,.1,-.15],elR:[-1.1,0,0],shL:[-.5,0,.2],elL:[-1.1,0,0]}; }
};
function setPose(h,name,fade=.35){ const A=h.userData.A; if(A.pose===name && A.poseTarget===1) return; if(name){ A.prevPose=A.pose; A.pose=name; A.poseTarget=1; A.poseT=0; } else A.poseTarget=0; A.poseFade=fade; }
function clearPose(h,fade=.35){ setPose(h,null,fade); }
const _lk=new THREE.Vector3(), _hw=new THREE.Vector3();
let HAND_TWIST=-1.35;
const JOINTS=['hips','spine','chest','head','shL','shR','elL','elR','hdL','hdR','thL','thR','knL','knR','ftL','ftR'];
const _R={}; for(const j of JOINTS) _R[j]=[0,0,0];
/* aim an arm so the INDEX FINGERTIP lands on a world point (2-bone IK: shoulder + elbow).
   w = how much (0..1) it overrides the current pose. Used for pressing real buttons. */
const _ik={a:new THREE.Vector3(),b:new THREE.Vector3(),c:new THREE.Vector3(),d:new THREE.Vector3(),q:new THREE.Quaternion()};
function aimArm(h,side,target,R,w=1,finger=.17){
  const J=h.userData.J, sh=J['sh'+side], el=J['el'+side], hd=J['hd'+side]; if(!sh||!el||!hd||w<=0) return;
  sh.getWorldPosition(_ik.a); el.getWorldPosition(_ik.b); hd.getWorldPosition(_ik.c);
  const sc=h.getWorldScale(_ik.d).x, a=_ik.a.distanceTo(_ik.b), b=_ik.b.distanceTo(_ik.c)+finger*sc;
  const dW=_ik.d.copy(target).sub(_ik.a); const D=Math.max(.05,Math.min(dW.length(),a+b-.002)); dW.normalize();
  sh.parent.getWorldQuaternion(_ik.q).invert(); dW.applyQuaternion(_ik.q);
  const gam=Math.acos(clamp((a*a+b*b-D*D)/(2*a*b),-1,1)), alp=Math.acos(clamp((a*a+D*D-b*b)/(2*a*D),-1,1));
  const tz=Math.asin(clamp(dW.x,-1,1)), tx=Math.atan2(-dW.z,-dW.y)+alp;
  const S=R['sh'+side], E=R['el'+side], H=R['hd'+side];
  S[0]=lerp(S[0],tx,w); S[1]=lerp(S[1],0,w); S[2]=lerp(S[2],tz,w); E[0]=lerp(E[0],-(Math.PI-gam),w); E[1]=lerp(E[1],0,w); E[2]=lerp(E[2],0,w); H[0]=lerp(H[0],0,w); H[2]=lerp(H[2],0,w);
}
function animateHuman(h,dt,t){
  const U=h.userData, J=U.J, A=U.A;
  if(!h.visible) return;
  if(A.dead){ return; }
  // measured speed drives the walk cycle
  h.getWorldPosition(_hw);
  const moved=Math.hypot(_hw.x-A.lastPos.x,_hw.z-A.lastPos.z); A.lastPos.copy(_hw);
  const sp=(dt>0&&!A.seated)?Math.min(8,moved/dt/h.scale.x):0; A.speed=damp(A.speed,sp>.05&&sp<8?sp:0,10,dt);
  const R=_R; for(const j of JOINTS){ R[j][0]=0; R[j][1]=0; R[j][2]=0; }
  let fL=.35, fR=.35;
  A.breath+=dt*1.4; const br=Math.sin(A.breath);
  // --- base idle ---
  R.shL[2]=.09+br*.01; R.shR[2]=-.09-br*.01; R.elL[0]=-.18; R.elR[0]=-.18; R.hdL[1]=HAND_TWIST; R.hdR[1]=-HAND_TWIST;   // palms face the legs (they faced forward = robot hands)
  R.chest[0]=-br*.012;
  if(!A.idleOff){ const sw=Math.sin(t*.45+A.phase); R.hips[2]=sw*.02; R.spine[2]=-sw*.02; R.knL[0]=Math.max(0,sw)*.1; R.knR[0]=Math.max(0,-sw)*.1; R.thL[0]=-Math.max(0,sw)*.05; R.thR[0]=-Math.max(0,-sw)*.05; R.ftL[1]=.1; R.ftR[1]=-.1; }
  // --- walk / run ---
  const wk=smooth(A.speed/.6);
  if(wk>0.001){
    const run=smooth((A.speed-2.2)/1.5);
    A.walkPhase+=dt*A.speed/(lerp(1.3,2.1,run))*Math.PI*2;
    const s=Math.sin(A.walkPhase), c=Math.cos(A.walkPhase), amp=lerp(.45,.75,run);
    const W=(j,a,v)=>{ R[j][a]=lerp(R[j][a],v,wk); };
    W('thL',0,-s*amp); W('thR',0,s*amp);
    W('knL',0,Math.max(0,c)*lerp(.9,1.6,run)+.08); W('knR',0,Math.max(0,-c)*lerp(.9,1.6,run)+.08);
    W('ftL',0,s>0?-.12:.25*Math.max(0,-c)); W('ftR',0,s<0?-.12:.25*Math.max(0,c));
    W('shL',0,s*lerp(.35,.7,run)); W('shR',0,-s*lerp(.35,.7,run));
    W('elL',0,-.25-Math.max(0,-s)*.4-run*.9); W('elR',0,-.25-Math.max(0,s)*.4-run*.9);
    W('spine',1,-s*.07); W('hips',1,s*.08); W('spine',0,.04+run*.12); W('hips',2,-c*.025);
    J.hips.position.y=.92+(Math.abs(Math.cos(A.walkPhase))*.022-.012)*wk*(1+run);
  } else J.hips.position.y=damp(J.hips.position.y,A.seated?.92:.92,8,dt);
  // --- idle gestures ---
  if(!A.pose && wk<.1 && !A.talk && !A.idleOff){
    if(!A.gest){ A.gestT-=dt; if(A.gestT<=0){ A.gest={n:pick(['scratch','shift','look','stretch','hips','watch']),t:0,d:rand(2,3.5)}; } }
    else { const gg=A.gest; gg.t+=dt; const w=Math.sin(Math.PI*clamp(gg.t/gg.d,0,1));
      if(gg.n==='scratch'){ R.shR[0]+=-2.4*w; R.shR[2]+=-.35*w; R.elR[0]+=(-1.6+Math.sin(t*20)*.15)*w; R.head[2]+=.12*w; }
      if(gg.n==='shift'){ R.hips[2]+=.05*w; R.knR[0]+=.2*w; }
      if(gg.n==='look'){ R.spine[1]+=.25*w; }
      if(gg.n==='stretch'){ R.shL[0]+=-.3*w; R.shR[0]+=-.3*w; R.shL[2]+=.4*w; R.shR[2]-=.4*w; R.elL[0]-=1.8*w; R.elR[0]-=1.8*w; R.chest[0]-=.1*w; }
      if(gg.n==='hips'){ R.shL[2]+=.4*w; R.shR[2]-=.4*w; R.elL[0]-=1.4*w; R.elR[0]-=1.4*w; R.elL[1]+=.5*w; R.elR[1]-=.5*w; }
      if(gg.n==='watch'){ R.shL[0]+=-.9*w; R.elL[0]+=-1.3*w; R.elL[1]+=.9*w; R.head[0]+=.3*w; }
      if(gg.t>=gg.d){ A.gest=null; A.gestT=rand(5,11); } }
  }
  // --- talking gestures (subtle) ---
  if(A.talk && !A.pose && wk<.1){ const s=Math.sin(t*2.3+A.phase), c=Math.cos(t*1.6+A.phase*2); R.shR[0]+=-.1+s*.06; R.elR[0]+=-.32+c*.12; R.shL[0]+=-.03+c*.03; R.elL[0]+=-.12+s*.05;   /* small hand moves (arms used to float way up while talking) */ R.head[0]+=Math.sin(t*5.3)*.03; R.head[2]+=Math.sin(t*2.9)*.035; }
  // --- scripted pose layer ---
  A.poseW=damp(A.poseW,A.poseTarget,1/Math.max(.05,A.poseFade)*2.2,dt); A.poseT+=dt;
  if(A.pose && A.poseW>0.001){
    const P=(typeof A.pose==='function'?A.pose:POSES[A.pose])(A.poseT,h)||{}, w=A.poseW;
    for(const j in P){ if(j==='fL'){ fL=lerp(fL,P.fL,w); continue; } if(j==='fR'){ fR=lerp(fR,P.fR,w); continue; } const r=R[j]; if(!r) continue; r[0]=lerp(r[0],P[j][0],w); r[1]=lerp(r[1],P[j][1],w); r[2]=lerp(r[2],P[j][2],w); }
    if(A.poseTarget===0 && A.poseW<.01) A.pose=null;
  }
  if(A.custom) A.custom(R,t,dt,A);
  if(A.funny) funnyHumanHook(h,R,t,A);
  // --- look at (head + eyes) ---
  let lx=0, ly=0;
  const tgt=A.look==='player'?camera.position:(A.look&&A.look.isVector3?A.look:(A.look&&A.look.getWorldPosition?A.look.getWorldPosition(_lk):null));
  let wantW=0;
  if(tgt){ wantW=1; }
  else if(A.autoLook){ const d=_hw.distanceTo(camera.position); if(d<5 && d>.3) wantW=.9; }
  A.lookW=damp(A.lookW,wantW,4,dt);
  if(A.lookW>0.01){
    const target=tgt||camera.position; _lk.copy(target); U.headJ.parent.updateMatrixWorld(); const hp=U.headJ.getWorldPosition(_hw);
    const dx=_lk.x-hp.x, dy=_lk.y-(hp.y+.1), dz=_lk.z-hp.z;
    const worldYaw=Math.atan2(dx,dz), bodyYaw=h.rotation.y+(h.parent&&h.parent.rotation?0:0);
    let yaw=angDiff(bodyYaw,worldYaw); const pitch=-Math.atan2(dy,Math.hypot(dx,dz));
    if(Math.abs(yaw)>2.2){ yaw=0; A.lookW=damp(A.lookW,0,6,dt); }
    lx=clamp(yaw,-1.2,1.2)*A.lookW; ly=clamp(pitch,-.6,.6)*A.lookW;
  }
  A.yawCur=damp(A.yawCur,lx,6,dt); A.pitchCur=damp(A.pitchCur,ly,6,dt);
  R.head[1]+=A.yawCur*.65; R.chest[1]+=A.yawCur*.25; R.head[0]+=A.pitchCur*.8;
  // apply
  for(const j of JOINTS){ const o=J[j]; if(!o) continue; o.rotation.set(R[j][0],R[j][1],R[j][2]); }
  // fingers (a hand holding something closes around it)
  if(h.userData.holdR && h.userData.holdR.children.some(c=>c.visible)) fR=Math.max(fR,.82);
  if(h.userData.holdL && h.userData.holdL.children.some(c=>c.visible)) fL=Math.max(fL,.82);
  for(const [side,f] of [['L',fL],['R',fR]]){ const H=U.hands[side].H; for(const fg of H.fingers){ fg.a.rotation.x=-f*1.2; fg.b.rotation.x=-f*1.3; if(fg.c) fg.c.rotation.x=-f*.95; } H.thumb2.rotation.x=-f*.6; }
  if(A.pointF){ const fg=U.hands[A.pointF].H.fingers[0]; fg.a.rotation.x=0; fg.b.rotation.x=-.08; if(fg.c) fg.c.rotation.x=-.05; }   // index finger out (pressing buttons)
  // --- face: eyes, blinks, brows, mouth ---
  A.saccT-=dt; if(A.saccT<=0){ A.saccT=rand(.25,1.6); A.sacc=[rand(-.12,.12),rand(-.07,.07)]; }
  const eyYaw=clamp((lx-A.yawCur)*1.2+A.sacc[0],-.5,.5), eyPitch=clamp((ly-A.pitchCur)+A.sacc[1],-.35,.35);
  for(const e of U.eyes){ e.rotation.y=damp(e.rotation.y,eyYaw,25,dt); e.rotation.x=damp(e.rotation.x,eyPitch,25,dt); }
  A.blinkT-=dt; if(A.blinkT<=0){ A.blink=.16; A.blinkT=Math.random()<.18?.3:rand(2,5.5); }
  let bl=0; if(A.blink>0){ A.blink-=dt; bl=Math.sin(Math.PI*clamp(1-A.blink/.16,0,1)); }
  const mk=A.moodK; const lidOpen=-.5+mk.lid+Math.max(0,eyPitch)*.6;
  for(const l of U.lids) l.rotation.x=A.sleep?.62:lerp(lidOpen,.62,bl);
  for(const l of U.lidsLo) l.rotation.x=.6-bl*.08-mk.smile*.1;
  const talkBrow=A.talk?Math.max(0,Math.sin(t*4.1))*.0025:0;
  U.brows.forEach((b,i)=>{ b.position.y=b.userData.base.y+mk.brow+talkBrow; b.rotation.z=(i===0?1:-1)*mk.browTilt*.6; });
  // mouth
  if(A.talk){ A.talkT-=dt; if(A.talkT<=0){ A.talkT=rand(.06,.13); A.mouthTarget=Math.random()<.2?0:rand(.25,.85); } }
  else A.mouthTarget=A.mouthHold||0;
  A.mouth=damp(A.mouth,A.mouthTarget,22,dt);
  const mi=U.head.morphTargetInfluences; if(mi){ mi[0]=A.mouth*.75; mi[1]=damp(mi[1],mk.smile,6,dt); mi[2]=damp(mi[2],mk.frown,6,dt); }
  if(U.J.jaw) U.J.jaw.rotation.x=A.mouth*.22;
  for(const sh of U.J.morphShells) sh.morphTargetInfluences[0]=A.mouth*.75;
  if(U.J.antennae) U.J.antennae.forEach((a,i)=>{ a.rotation.x=Math.sin(t*2+i)*.15; });
}
/* ---------- NPC helpers ---------- */
/* walk along points; returns a promise. Speed in m/s. Turns smoothly toward travel direction. */
function walkTo(h,points,speed=1.3,faceEnd=null){
  if(!Array.isArray(points)) points=[points];
  const tok=STORY.token;
  return new Promise(res=>{
    const A=h.userData.A; let len=0, prev=h.position.clone(); for(const q of points){ len+=Math.hypot(q.x-prev.x,q.z-prev.z); prev=q; }
    // safety: a walk can never hang the story (blocked, stuck): after twice the time it should take, they arrive anyway
    A.path={pts:points.map(p=>p.clone()),i:0,speed,faceEnd,res,tok,t:0,maxT:len/Math.max(.1,speed)*2+3,blockT:0};
  });
}
function updateNPCPath(h,dt){
  const A=h.userData.A, P=A.path; if(!P) return;
  if(P.tok!==STORY.token){ A.path=null; return; }
  P.t=(P.t||0)+dt;
  if(P.maxT&&P.t>P.maxT){ const last=P.pts[P.pts.length-1]; h.position.x=last.x; h.position.z=last.z; A.path=null; if(P.faceEnd!=null) A.faceYaw=P.faceEnd; P.res(); return; }
  const tgt=P.pts[P.i]; const dx=tgt.x-h.position.x, dz=tgt.z-h.position.z, d=Math.hypot(dx,dz);
  const step=P.speed*dt;
  if(d<=step+.001){ h.position.x=tgt.x; h.position.z=tgt.z; P.i++; if(P.i>=P.pts.length){ A.path=null; if(P.faceEnd!=null) A.faceYaw=P.faceEnd; P.res(); return; } return; }
  h.position.x+=dx/d*step; h.position.z+=dz/d*step;
  // don't walk through the player: slide around them
  { const px=h.position.x-PLAYER.pos.x, pz=h.position.z-PLAYER.pos.z, pd=Math.hypot(px,pz), R=.8*h.scale.x; if(pd<R&&pd>1e-4&&!P.noAvoid){ P.blockT=(P.blockT||0)+dt; if(P.blockT>1.2) P.noAvoid=true; else { h.position.x=PLAYER.pos.x+px/pd*R; h.position.z=PLAYER.pos.z+pz/pd*R; } } }
  if(tgt.y!==undefined && P.useY) h.position.y+=(tgt.y-h.position.y)*Math.min(1,step/d);
  const want=Math.atan2(dx,dz); h.rotation.y=angLerp(h.rotation.y,want,Math.min(1,dt*8));
  A.faceYaw=null;
}
function faceYaw(h,yaw){ h.userData.A.faceYaw=yaw; }
function facePoint(h,p){ h.userData.A.faceYaw=Math.atan2(p.x-h.position.x,p.z-h.position.z); }
function updateHumans(dt,t){
  for(const h of HUMANS){
    if(!h.parent || !h.visible) continue;
    if(LV && h.userData.level && h.userData.level!==LV.name) continue;
    updateNPCPath(h,dt);
    if(h.userData.snapGround && LV && LV.ground) h.position.y=LV.ground(h.position.x,h.position.z);
    const A=h.userData.A;
    if(A.faceNear && !A.path && !A.noTurn && !(A.pose && NO_TURN_POSE.test(A.pose)) && G.mode==='play'){
      const dx=camera.position.x-h.position.x, dz=camera.position.z-h.position.z, d=Math.hypot(dx,dz);
      if(A.look==='player' || (d<4.5 && d>.4)) A.faceYaw=Math.atan2(dx,dz);
    }
    if(A.faceYaw!=null && !A.path) h.rotation.y=angLerp(h.rotation.y,A.faceYaw,Math.min(1,dt*5));
    animateHuman(h,dt,t);
  }
}
/* attach a prop to a hand */
function holdProp(h,prop,side='R',pos,rot){ const hold=side==='R'?h.userData.holdR:h.userData.holdL; hold.add(prop); if(pos) prop.position.copy(pos); if(rot) prop.rotation.copy(rot); return prop; }

/* ---------- character presets ---------- */
function makeJim(o={}){ return makeHuman(Object.assign({name:'Jim',voice:'Jim',skin:0xecc0a0,shirt:0xd9a441,pants:0x3a4a6a,shoes:0x6b4a2a,hair:0x7a4a22,hairStyle:'spiky',beard:true,eye:0x3a6a3a,mood:'happy',build:1.04,head:{rx:.076,ry:.104,rz:.094,jaw:.26,nose:1.15,chin:1.1},seed:5,browThick:.004},o)); }
function makeYou(o={}){ return makeHuman(Object.assign({name:'You',voice:'You',skin:0xe2b08c,shirt:0x2f4d6e,pants:0x2e3440,shoes:0x2a2a2e,hair:0x2a1c12,hairStyle:'short',eye:0x4a3020,sleeves:'long',hood:true,collar:false,stubble:.14,head:{rx:.073,ry:.103,rz:.092,jaw:.3,nose:.95}},o)); }
function makeSteve(o={}){ return makeHuman(Object.assign({name:'Steve',voice:'Steve',skin:0x5fd648,skinGlow:.09,sss:[.5,1,.45],shirt:0x2a2f28,pants:0x1c211c,shoes:0x111111,hairStyle:'bald',eye:0x101010,sleeves:'long',collar:false,denim:false,build:.95,height:1.05,head:{rx:.072,ry:.108,rz:.095,jaw:.36,nose:.7,chin:1.2,lips:.6},blush:0,lip:0x5a8a4a},o)); }
function makeAlien(o={}){ const pal=pick([[0x5fb8e8,0x5a2fa0,0xff7af0],[0x6ae0b0,0x1c4a7a,0xffe066],[0xb08ae0,0x2a5a4a,0x7dffe8],[0xe08a6a,0x3a1a5a,0x7dffb0]]); return markAlien(makeHuman(Object.assign({name:'Alien',voice:'Alien',alien:true,skin:pal[0],shirt:pal[1],pants:0x1a1c30,shoes:0x2a2a4a,accent:pal[2],sleeves:'long',hairStyle:'bald',denim:false,collar:false,build:.92,height:rand(.92,1.05)},o))); }
/* aliens turn their whole body to you when you talk to them or walk up close (they used to stare at their house) */
function markAlien(h){ h.userData.isAlien=true; h.userData.A.faceNear=true; h.userData.A.autoLook=true; return h; }
const NO_TURN_POSE=/sit|sleep|lie|drive|climb|dead|chain|ride|droop/i;

/* ---------- robots (Mars) ---------- */
function robotFaceMat(hue){
  const u={time:{value:0},blink:{value:0},mood:{value:0},talk:{value:0},col:{value:col(hue||0x6dffd8)},look:{value:new THREE.Vector2()}};
  const m=new THREE.ShaderMaterial({uniforms:u,vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform float time,blink,mood,talk; uniform vec3 col; uniform vec2 look; varying vec2 vUv;
    float rbox(vec2 p,vec2 b,float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
    void main(){ vec2 p=vUv*2.0-1.0; p.x*=1.4; vec3 c=vec3(0.01,0.02,0.03); float e=1e3;
      for(int i=0;i<2;i++){ float sx=i==0?-0.45:0.45; vec2 q=p-vec2(sx,0.15)-look*0.15; float h=mix(0.26,0.02,blink);
        float d = mood>0.5 ? abs(length(q-vec2(0.0,-0.15))-0.2)-0.05+step(q.y,-0.12)*1.0 : rbox(q,vec2(0.14,h),0.08); e=min(e,d); }
      float m=talk>0.0? rbox(p-vec2(0.0,-0.5),vec2(0.22,0.03+talk*0.12),0.05) : abs(length(p-vec2(0.0,-0.25))-0.35)-0.035+step(-0.45,p.y)*1.0;
      e=min(e,m);
      float g=smoothstep(0.02,0.0,e); float glow=exp(-max(e,0.0)*14.0)*0.35;
      c+=col*(g*2.5+glow); c+=col*0.04*(0.5+0.5*sin(vUv.y*300.0+time*4.0));
      gl_FragColor=vec4(c,1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`});
  m.userData.u=u; return m;
}
const ROBOTS=[];
function makeRobot(o={}){
  const opt=Object.assign({body:0xe8ecf0,trim:0xff7a45,face:0x6dffd8,height:1,kind:'legs',name:'Robot',voice:'Robot'},o);
  const g=new THREE.Group(); g.name=opt.name;
  const shell=new THREE.MeshPhysicalMaterial({color:col(opt.body),roughness:.25,metalness:.35,clearcoat:1,clearcoatRoughness:.08});
  const dark=mat(0x2a2e34,{roughness:.4,metalness:.7}), trim=mat(opt.trim,{roughness:.35,metalness:.3}), glow=emissiveMat(opt.face,3);
  const hips=new THREE.Group(); hips.position.y=opt.kind==='hover'?.75:.9; g.add(hips);
  const torso=new THREE.Group(); torso.position.y=.05; hips.add(torso);
  torso.add(mesh(roundedBoxGeo(.42,.5,.3,.1),shell,0,.3,0));
  torso.add(mesh(roundedBoxGeo(.3,.16,.02,.02),dark,0,.36,.152,false));
  const chestLight=mesh(GC('rCL',()=>new THREE.CircleGeometry(.04,20)),glow,0,.36,.163,false); torso.add(chestLight);
  const rbelt=mesh(GC('rBelt',()=>new THREE.CylinderGeometry(.2,.2,.06,20)),trim,0,.05,0,false); rbelt.scale.z=.75; torso.add(rbelt);
  const neck=new THREE.Group(); neck.position.y=.58; torso.add(neck); neck.add(mesh(GC('rNeck',()=>new THREE.CylinderGeometry(.05,.06,.1,12)),dark,0,.02,0));
  const head=new THREE.Group(); head.position.y=.16; neck.add(head);
  head.add(mesh(roundedBoxGeo(.34,.26,.26,.08),shell,0,.03,0));
  const faceM=robotFaceMat(opt.face); const face=mesh(GC('rFace',()=>new THREE.PlaneGeometry(.27,.18)),faceM,0,.03,.131,false); head.add(face);
  head.add(mesh(GC('rAnt',()=>new THREE.CylinderGeometry(.006,.006,.14,6)),dark,.1,.22,0,false)); head.add(mesh(GC('rAntB',()=>new THREE.SphereGeometry(.018,10,8)),glow,.1,.29,0,false));
  for(const sd of [1,-1]) head.add(mesh(GC('rEar',()=>{ const c=new THREE.CylinderGeometry(.05,.05,.04,16); c.rotateZ(Math.PI/2); return c; }),trim,sd*.18,.03,0,false));
  const arms={};
  for(const sd of [1,-1]){
    const sh=new THREE.Group(); sh.position.set(sd*.26,.47,0); torso.add(sh);
    sh.add(mesh(GC('rSh',()=>new THREE.SphereGeometry(.07,14,10)),trim,0,0,0));
    sh.add(mesh(GC('rUA',()=>{ const c=new THREE.CylinderGeometry(.035,.04,.26,12); c.translate(0,-.14,0); return c; }),dark,0,0,0));
    const el=new THREE.Group(); el.position.y=-.28; sh.add(el); el.add(mesh(GC('rEl',()=>new THREE.SphereGeometry(.045,12,8)),shell,0,0,0));
    el.add(mesh(GC('rFA',()=>{ const c=new THREE.CylinderGeometry(.045,.035,.24,12); c.translate(0,-.12,0); return c; }),shell,0,0,0));
    const hand=new THREE.Group(); hand.position.y=-.27; el.add(hand);
    for(let i=0;i<3;i++){ const f=mesh(GC('rFing',()=>{ const b=new THREE.BoxGeometry(.018,.07,.018); b.translate(0,-.035,0); return b; }),dark,(i-1)*.025,0,i===1?-.02:.01,false); hand.add(f); }
    const hold=new THREE.Group(); hold.position.set(0,-.06,.03); hand.add(hold);
    arms[sd>0?'L':'R']={sh,el,hand,hold};
  }
  const legs={};
  if(opt.kind==='legs'){
    for(const sd of [1,-1]){ const th=new THREE.Group(); th.position.set(sd*.11,0,0); hips.add(th);
      th.add(mesh(GC('rTh',()=>{ const c=new THREE.CylinderGeometry(.05,.045,.42,12); c.translate(0,-.21,0); return c; }),dark,0,0,0));
      const kn=new THREE.Group(); kn.position.y=-.44; th.add(kn); kn.add(mesh(GC('rKn',()=>new THREE.SphereGeometry(.055,12,8)),trim,0,0,0));
      kn.add(mesh(GC('rSn',()=>{ const c=new THREE.CylinderGeometry(.06,.045,.4,12); c.translate(0,-.2,0); return c; }),shell,0,0,0));
      const ft=new THREE.Group(); ft.position.y=-.42; kn.add(ft); ft.add(mesh(roundedBoxGeo(.12,.06,.22,.025),dark,0,-.02,.04));
      legs[sd>0?'L':'R']={th,kn,ft}; }
  } else {
    hips.add(mesh(GC('rSkirt',()=>new THREE.CylinderGeometry(.18,.24,.3,20)),shell,0,-.15,0));
    const jet=mesh(GC('rJet',()=>new THREE.CircleGeometry(.16,20)),emissiveMat(0x7ad8ff,4),0,-.31,0,false); jet.rotation.x=Math.PI/2; hips.add(jet);
  }
  g.userData={robot:true,faceM,hips,torso,head,neck,arms,legs,chestLight,name:opt.name,voice:opt.voice,
    A:{walkPhase:0,speed:0,lastPos:new THREE.Vector3(),talk:false,pose:null,t:Math.random()*10,blinkT:rand(1,4),look:null,faceYaw:null,path:null,eatT:0,kind:opt.kind,happy:false}};
  g.scale.setScalar(opt.height);
  ROBOTS.push(g); return g;
}
function animateRobot(r,dt,t){
  const U=r.userData, A=U.A; if(!r.visible) return;
  r.getWorldPosition(_hw); const moved=Math.hypot(_hw.x-A.lastPos.x,_hw.z-A.lastPos.z); A.lastPos.copy(_hw); const sp=dt>0?Math.min(6,moved/dt):0; A.speed=damp(A.speed,sp<6?sp:0,10,dt);
  A.t+=dt; const wk=smooth(A.speed/.5);
  const u=U.faceM.uniforms; u.time.value=t;
  A.blinkT-=dt; if(A.blinkT<=0){ A.blink=.14; A.blinkT=rand(2,5); } if(A.blink>0){ A.blink-=dt; u.blink.value=Math.sin(Math.PI*clamp(1-A.blink/.14,0,1)); } else u.blink.value=0;
  u.mood.value=A.happy?1:0; u.talk.value=A.talk?(.3+.7*Math.abs(Math.sin(t*14+Math.sin(t*5)))):0;
  if(A.kind==='hover'){ U.hips.position.y=.75+Math.sin(t*2+A.t)*.04; }
  else if(wk>0.01){ A.walkPhase+=dt*A.speed/1.1*Math.PI*2; const s=Math.sin(A.walkPhase), c=Math.cos(A.walkPhase);
    U.legs.L.th.rotation.x=-s*.5*wk; U.legs.R.th.rotation.x=s*.5*wk; U.legs.L.kn.rotation.x=Math.max(0,c)*.8*wk; U.legs.R.kn.rotation.x=Math.max(0,-c)*.8*wk;
    U.hips.position.y=.9+Math.abs(c)*.025*wk; U.arms.L.sh.rotation.x=s*.4*wk; U.arms.R.sh.rotation.x=-s*.4*wk; }
  else if(U.legs.L){ for(const k of ['L','R']){ U.legs[k].th.rotation.x=damp(U.legs[k].th.rotation.x,0,8,dt); U.legs[k].kn.rotation.x=damp(U.legs[k].kn.rotation.x,0,8,dt); } }
  const eat=A.pose==='eat'; const k=Math.max(0,Math.sin(t*3+A.t));
  U.arms.R.sh.rotation.x=damp(U.arms.R.sh.rotation.x,eat?-1.2-k*.5:(A.talk?-.18+Math.sin(t*3)*.08:(wk>0.01?U.arms.R.sh.rotation.x:0)),8,dt);
  U.arms.R.el.rotation.x=damp(U.arms.R.el.rotation.x,eat?-1.2:(A.talk?-.45:-.2),8,dt);
  U.arms.L.el.rotation.x=damp(U.arms.L.el.rotation.x,eat?-1.3:-.2,8,dt); if(eat) U.arms.L.sh.rotation.x=damp(U.arms.L.sh.rotation.x,-.8,8,dt);
  U.arms.L.sh.rotation.z=.12; U.arms.R.sh.rotation.z=-.12;
  U.head.rotation.z=Math.sin(t*.7+A.t)*.06+(A.talk?Math.sin(t*6)*.05:0);
  // look
  const tgt=A.look==='player'?camera.position:null; if(tgt||_hw.distanceTo(camera.position)<5){ const p=U.head.getWorldPosition(new THREE.Vector3()); const yaw=angDiff(r.rotation.y,Math.atan2(camera.position.x-p.x,camera.position.z-p.z)); U.neck.rotation.y=damp(U.neck.rotation.y,Math.abs(yaw)<2?clamp(yaw,-1,1):0,5,dt); } else U.neck.rotation.y=damp(U.neck.rotation.y,0,3,dt);
  U.chestLight.scale.setScalar(1+Math.sin(t*3+A.t)*.08);
}
function updateRobots(dt,t){ for(const r of ROBOTS){ if(!r.parent||!r.visible) continue; if(LV && r.userData.level && r.userData.level!==LV.name) continue; updateNPCPath(r,dt); const A=r.userData.A; if(A.faceYaw!=null && !A.path) r.rotation.y=angLerp(r.rotation.y,A.faceYaw,Math.min(1,dt*5)); animateRobot(r,dt,t); } }

