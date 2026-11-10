/* ================================================================
   JEFF — a golden retriever. A real dog shape (deep chest, tucked belly,
   long muzzle, floppy ears, angled back legs, feathered tail) covered in
   fur: the body is drawn 6 times, each layer a bit further out with
   fewer and thinner hairs, so it looks like real fur and not plastic.
   Same parts as before (headJ, tail, legs, tongue) so every scene works.
   ================================================================ */
const DOGCOL={gold:col(0xa87a45),cream:col(0xd8bc92),dark:col(0x7e5228),belly:col(0xcaa878)};
function dogFurTex(){ return texSet('dogFur',256,(x,w,h)=>{ x.fillStyle='#e6e0d8'; x.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){ const px=Math.random()*w, py=Math.random()*h, L=4+Math.random()*10, v=200+Math.random()*55|0; x.strokeStyle=`rgba(${v},${v-8},${v-20},.55)`; x.lineWidth=.8+Math.random(); x.beginPath(); x.moveTo(px,py); x.lineTo(px+(Math.random()-.5)*3,py+L); x.stroke(); } },{strength:1.2}); }
/* fur layer k (0 = the skin, 1 = hair tips): pushed out along the surface, droops a little, hairs get rarer + thinner */
function dogFurMat(k,len,den){
  const T=dogFurTex();
  const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,map:T.map,normalMap:k===0?T.normalMap:null});
  m.onBeforeCompile=sh=>{ sh.uniforms.furK={value:k}; sh.uniforms.furLen={value:len}; sh.uniforms.furDen={value:den};
    sh.vertexShader='uniform float furK; uniform float furLen; varying vec3 vFurP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vFurP=position; transformed+=objectNormal*furK*furLen; transformed.y-=furK*furK*furLen*.45;');
    sh.fragmentShader='uniform float furK; uniform float furDen; varying vec3 vFurP;\nfloat furH(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }\n'+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n { vec3 q=vFurP*furDen; float h=furH(floor(q)); float r=length(fract(q)-.5); if(furK>0.){ if(h<furK*.92 || r>.6-furK*.38) discard; } diffuseColor.rgb*=mix(.62,1.06,furK); }');
  };
  return m;
}
const DOGMATS={};
function dogMats(len){ const key='L'+len; if(DOGMATS[key]) return DOGMATS[key]; const N=6, out=[]; for(let i=0;i<N;i++) out.push(dogFurMat(i/(N-1)*.999,len,620)); return DOGMATS[key]=out; }
/* geometry helpers (everything baked into real geometry, no scaling, so the hairs are the same size everywhere) */
function dogMerge(list){
  const parts=list.map(g=>g.index?g.toNonIndexed():g); let n=0; for(const g of parts) n+=g.attributes.position.count;
  const P=new Float32Array(n*3), N=new Float32Array(n*3), U=new Float32Array(n*2); let o=0;
  for(const g of parts){ P.set(g.attributes.position.array,o*3); N.set(g.attributes.normal.array,o*3); if(g.attributes.uv) U.set(g.attributes.uv.array,o*2); o+=g.attributes.position.count; }
  const out=new THREE.BufferGeometry(); out.setAttribute('position',new THREE.BufferAttribute(P,3)); out.setAttribute('normal',new THREE.BufferAttribute(N,3)); out.setAttribute('uv',new THREE.BufferAttribute(U,2)); return out;
}
/* a lathe lying along +z (pts = [radius, z]), squashed/bent per vertex by fn(x,y,z) */
function dogTube(pts,seg,fn){ const g=new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg); g.rotateX(Math.PI/2);
  if(fn){ const P=g.attributes.position; for(let i=0;i<P.count;i++){ const v=fn(P.getX(i),P.getY(i),P.getZ(i)); P.setXYZ(i,v[0],v[1],v[2]); } }
  g.computeVertexNormals(); return g; }
/* a tapered limb piece from a to b (rounded ends) */
function dogSeg(a,b,r0,r1){ const d=b.clone().sub(a), L=d.length(); const g=new THREE.CylinderGeometry(r1,r0,L,14,3,false); g.translate(0,L/2,0);
  const q=new THREE.Quaternion().setFromUnitVectors(V3(0,1,0),d.normalize()); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate(a.x,a.y,a.z);
  const s0=new THREE.SphereGeometry(r0,14,10); s0.translate(a.x,a.y,a.z); const s1=new THREE.SphereGeometry(r1,14,10); s1.translate(b.x,b.y,b.z); return [g,s0,s1]; }
function dogBlob(r,sx,sy,sz,x,y,z,ws=20,hs=14){ const g=new THREE.SphereGeometry(r,ws,hs); g.scale(sx,sy,sz); g.translate(x,y,z); return g; }
/* colour each vertex: cream chest, belly and leg feathering, darker ears and back */
function dogPaint(g,fn){ const P=g.attributes.position, C=new Float32Array(P.count*3), c=new THREE.Color();
  for(let i=0;i<P.count;i++){ fn(P.getX(i),P.getY(i),P.getZ(i),c); C[i*3]=c.r; C[i*3+1]=c.g; C[i*3+2]=c.b; }
  g.setAttribute('color',new THREE.BufferAttribute(C,3)); return g; }
function dogMix(c,a,b,t){ t=Math.max(0,Math.min(1,t)); c.setRGB(a.r+(b.r-a.r)*t,a.g+(b.g-a.g)*t,a.b+(b.b-a.b)*t); }
/* one furry part: the skin mesh (casts shadow) + 5 hair layers */
function dogFurry(geo,len){ const M=dogMats(len), grp=new THREE.Group();
  const base=new THREE.Mesh(geo,M[0]); base.castShadow=true; base.receiveShadow=true; grp.add(base);
  for(let i=1;i<M.length;i++){ const s=new THREE.Mesh(geo,M[i]); s.castShadow=false; s.receiveShadow=true; grp.add(s); }
  grp.userData.base=base; return grp; }
const DOGGEO={};
function dogGeos(){
  if(DOGGEO.body) return DOGGEO;
  const G=DOGCOL;
  // ---- body: deep chest in front, belly tucked up toward the back legs, flat back ----
  const torso=dogTube([[0,-.36],[.07,-.355],[.12,-.33],[.15,-.29],[.16,-.22],[.155,-.12],[.15,-.02],[.162,.07],[.178,.15],[.182,.21],[.17,.26],[.13,.305],[.07,.325],[0,.33]],28,(x,y,z)=>{
    const t=Math.max(0,Math.min(1,(z+.36)/.69)); x*=.74; if(y<0) y*=lerp(.62,1.22,Math.pow(t,1.4)); else y*=.82; return [x,y+.44,z]; });
  const neck=dogTube([[0,-.02],[.105,0],[.1,.08],[.088,.17],[.08,.24],[0,.26]],22,(x,y,z)=>{ x*=.86; const a=-.85, c=Math.cos(a), s=Math.sin(a); return [x,y*c-z*s+.53,y*s+z*c+.19]; });
  const ruff=dogBlob(.12,.95,1.05,.7,0,.43,.27);   // the fluffy chest in front
  DOGGEO.body=dogPaint(dogMerge([torso,neck,ruff]),(x,y,z,c)=>{ const under=Math.max(0,(.42-y)/.2), chest=z>.18?Math.max(0,(.5-y)/.2):0; dogMix(c,G.gold,G.cream,Math.max(under*.85,chest)); if(y>.56) dogMix(c,c,G.dark,(y-.56)/.12*.35); });
  // ---- head (around headJ = between the eyes and the back of the skull) ----
  const skull=dogBlob(.085,1,.9,1.12,0,.02,-.035,24,16);
  const cheek=dogBlob(.07,1.15,.8,1,0,-.015,.0,18,12);
  const muzzle=dogTube([[0,.0],[.052,.01],[.05,.06],[.044,.11],[.036,.15],[.02,.168],[0,.172]],18,(x,y,z)=>[x*1.02,y*.82-.028+(y<0?-.004:0),z+.0]);
  const jaw=dogTube([[0,.0],[.034,.01],[.03,.08],[.022,.125],[0,.135]],14,(x,y,z)=>[x,y*.6-.066,z+.01]);
  const earG=[]; for(const sd of [-1,1]){ const e=dogBlob(.062,.26,1.2,.8,0,-.06,0,14,12); e.rotateZ(sd*.18); e.rotateY(sd*.25); e.translate(sd*.078,.035,-.045); earG.push(e); }
  DOGGEO.head=dogPaint(dogMerge([skull,cheek,muzzle,jaw,...earG]),(x,y,z,c)=>{ const ear=Math.abs(x)>.07&&z<0?1:0; dogMix(c,G.gold,G.dark,ear*.6); if(z>.06&&y<-.03) dogMix(c,c,G.cream,.5); });
  // ---- legs (each from its own hip/shoulder pivot, foot on the ground at y=-pivot) ----
  const legPaint=(py)=>(x,y,z,c)=>{ const back=z<-.01?1:0; dogMix(c,G.gold,G.cream,back*.65+(y<-py+.12?.3:0)); };
  const front=[], FP=.42; front.push(...dogSeg(V3(0,.02,0),V3(0,-.16,.01),.058,.042), ...dogSeg(V3(0,-.16,.01),V3(0,-.34,.0),.04,.031), ...dogSeg(V3(0,-.34,0),V3(0,-.385,.02),.03,.029));
  front.push(dogBlob(.036,1,.62,1.3,0,-.398,.035,16,10));
  DOGGEO.front=dogPaint(dogMerge(front),legPaint(FP));
  const rear=[], RP=.44; rear.push(...dogSeg(V3(0,.02,-.01),V3(0,-.2,.065),.075,.048), ...dogSeg(V3(0,-.2,.065),V3(0,-.33,-.06),.045,.03), ...dogSeg(V3(0,-.33,-.06),V3(0,-.41,-.045),.03,.028));
  rear.push(dogBlob(.036,1,.62,1.3,0,-.42,-.025,16,10));
  DOGGEO.rear=dogPaint(dogMerge(rear),legPaint(RP));
  // ---- tail: long, feathered, a gentle curve (along local +y so it can wag on z) ----
  const tl=[]; let p=V3(0,0,0), dir=V3(0,1,0); const rs=[.034,.03,.024,.017,.01];
  for(let i=0;i<4;i++){ const q=p.clone().addScaledVector(dir,.085); tl.push(...dogSeg(p,q,rs[i],rs[i+1])); p=q; dir.applyAxisAngle(V3(1,0,0),.16).normalize(); }
  DOGGEO.tail=dogPaint(dogMerge(tl),(x,y,z,c)=>{ dogMix(c,G.gold,G.cream,z>.0?.7:.15+y); });
  return DOGGEO;
}
function makeDog(){
  const D=dogGeos(), g=new THREE.Group(), rig=new THREE.Group(); g.add(rig);
  const body=dogFurry(D.body,.024); rig.add(body);
  // head
  const headJ=new THREE.Group(); headJ.position.set(0,.71,.39); rig.add(headJ);
  headJ.add(dogFurry(D.head,.016));
  const noseM=new THREE.MeshPhysicalMaterial({color:col(0x171311),roughness:.32,clearcoat:.7,clearcoatRoughness:.25});
  const nose=new THREE.Mesh(GC('dogNose',()=>dogBlob(.024,1.2,.85,.85,0,0,0,16,12)),noseM); nose.position.set(0,-.012,.175); headJ.add(nose);
  for(const sd of [-1,1]){ const ns=new THREE.Mesh(GC('dogNostril',()=>dogBlob(.007,1,.6,.7,0,0,0,8,6)),mat(0x050403,{roughness:.6})); ns.position.set(sd*.011,-.014,.195); headJ.add(ns); }
  const eyeM=new THREE.MeshPhysicalMaterial({color:col(0x2a1608),roughness:.05,clearcoat:1,clearcoatRoughness:.02});
  const rimM=mat(0x1a0e08,{roughness:.6});
  for(const sd of [-1,1]){ const e=new THREE.Mesh(GC('dogEye',()=>new THREE.SphereGeometry(.0145,16,12)),eyeM); e.position.set(sd*.043,.032,.052); headJ.add(e);
    const r=new THREE.Mesh(GC('dogEyeRim',()=>new THREE.TorusGeometry(.0148,.0028,6,20)),rimM); r.position.copy(e.position); r.position.z+=.002; r.rotation.y=sd*.55; headJ.add(r); }
  const lipM=mat(0x2a1a14,{roughness:.6});
  const lip=new THREE.Mesh(GC('dogLip',()=>{ const t=new THREE.TorusGeometry(.04,.004,6,20,Math.PI*.9); t.rotateX(Math.PI/2); t.rotateY(Math.PI*.55); return t; }),lipM); lip.position.set(0,-.062,.105); headJ.add(lip);
  const tongue=new THREE.Mesh(GC('dogTongue2',()=>{ const q=new THREE.SphereGeometry(.026,12,8); q.scale(1,.28,1.7); return q; }),new THREE.MeshPhysicalMaterial({color:col(0xd4606c),roughness:.3,clearcoat:.4})); tongue.position.set(0,-.076,.13); tongue.rotation.x=.35; headJ.add(tongue);
  // legs
  const legs=[];
  for(const [x,z,front] of [[.072,.22,1],[-.072,.22,1],[.078,-.25,0],[-.078,-.25,0]]){ const lg=new THREE.Group(); lg.position.set(x,front?.42:.44,z); rig.add(lg); lg.add(dogFurry(front?D.front:D.rear,front?.016:.02)); legs.push(lg); }
  // tail
  const tail=new THREE.Group(); tail.position.set(0,.53,-.34); rig.add(tail); tail.add(dogFurry(D.tail,.03)); tail.rotation.x=-1.75;
  g.userData={headJ,tail,legs,tongue,rig,phase:Math.random()*10,speed:0,lastPos:new THREE.Vector3(),head:headJ,A:{talk:false,moodK:{}}};
  return g;
}
function animateDog(d,dt,t){ const U=d.userData; d.getWorldPosition(_hw); const dx=_hw.x-U.lastPos.x, dz=_hw.z-U.lastPos.z, mv=Math.hypot(dx,dz); U.lastPos.copy(_hw); U.speed=damp(U.speed,dt>0?Math.min(6,mv/dt):0,8,dt);
  // a real trot: steps follow how far he actually moved (front-right with back-left), and he faces where he's going
  const w=Math.min(1,U.speed/1.1); U.walkPh=(U.walkPh||0)+Math.min(mv,.5)*7.5; const ph=[0,Math.PI,Math.PI,0];
  U.legs.forEach((l,i)=>{ l.rotation.x=Math.sin(U.walkPh+ph[i])*.5*w; });
  if(U.rig){ U.rig.position.y=Math.abs(Math.sin(U.walkPh))*.012*w; U.rig.scale.y=1+Math.sin(t*(U.happy?7:2.2)+U.phase)*.006; }   // trot bounce + breathing (panting when happy)
  if(U.speed>.3&&mv>1e-4&&U.autoFace!==false&&!U.stuck) d.rotation.y=angLerp(d.rotation.y,Math.atan2(dx,dz),Math.min(1,dt*7));
  U.tail.rotation.z=Math.sin(t*(U.happy?16:5))*(U.happy?.55:.18); U.tail.rotation.x=U.stuck?-2.5:(U.happy?-1.45:-1.85);
  U.headJ.rotation.x=Math.sin(t*2+U.phase)*.04-(U.A.talk?Math.abs(Math.sin(t*16))*.12:0); U.headJ.rotation.y=Math.sin(t*.7+U.phase)*.12;
  U.tongue.visible=!U.stuck; U.tongue.position.z=.13+(U.happy?.012+Math.sin(t*7)*.004:0); }
