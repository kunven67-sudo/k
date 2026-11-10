/* ================================================================
   THE TINYVERSE (Path A) — "It's like you're in space, but you're not."
   Zero-g flight through a microscopic world inside Jim's cage.
   ================================================================ */
function rimify(m,rimCol,k=1.2,p=2.5){
  const c=col(rimCol);
  const prev=m.onBeforeCompile, pk=m.customProgramCacheKey?m.customProgramCacheKey():'';
  m.onBeforeCompile=sh=>{ if(prev) prev(sh); sh.uniforms.rimC={value:c}; sh.fragmentShader='uniform vec3 rimC;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    { vec3 vd=normalize(vViewPosition); float fr=pow(1.0-abs(dot(normal,vd)),${p.toFixed(2)}); totalEmissiveRadiance+=rimC*fr*${k.toFixed(2)}; }`); };
  m.customProgramCacheKey=()=>pk+'rim'+rimCol+k+p; return m;
}
function iridescent(m){ m.onBeforeCompile=sh=>{ sh.uniforms.uT=WIND.time; sh.fragmentShader='uniform float uT;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  { vec3 vd=normalize(vViewPosition); float f=1.0-abs(dot(normal,vd)); vec3 ir=0.5+0.5*cos(6.2831*(f*1.3+vec3(0.0,0.33,0.67))+uT*0.3); totalEmissiveRadiance+=ir*pow(f,1.8)*.7; }`); }; m.customProgramCacheKey=()=>'irid'; return m; }
function wobble(m,amt=.12,speed=1){ const prev=m.onBeforeCompile; m.onBeforeCompile=sh=>{ if(prev) prev(sh); sh.uniforms.uT=WIND.time; sh.vertexShader='uniform float uT;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  float wb=sin(position.x*3.1+uT*${speed.toFixed(2)}*1.3)*cos(position.y*2.7+uT*${speed.toFixed(2)}*1.1)*sin(position.z*2.3+uT*${speed.toFixed(2)}*.9); transformed+=normal*wb*${amt.toFixed(3)};`); }; m.customProgramCacheKey=()=>'wob'+amt+speed; return m; }
function wrinkleTex(){ return texSet('wrinkle',512,(x,w,h)=>{ x.fillStyle='#909090'; x.fillRect(0,0,w,h); for(let i=0;i<70;i++){ const y=rand(0,h); x.strokeStyle=`rgba(${Math.random()<.5?40:200},${Math.random()<.5?40:200},${Math.random()<.5?40:200},${rand(.15,.4)})`; x.lineWidth=rand(2,7); x.beginPath(); x.moveTo(0,y); for(let k=0;k<=16;k++) x.lineTo(k*w/16,y+Math.sin(k*1.3+i)*rand(2,8)); x.stroke(); } for(let i=0;i<1500;i++){ x.fillStyle=`rgba(255,255,255,${Math.random()*.12})`; x.beginPath(); x.arc(rand(0,w),rand(0,h),rand(1,4),0,7); x.fill(); } },{strength:3.2}); }
function fiberTex(){ return texSet('fiber',[256,512],(x,w,h)=>{ x.fillStyle='#b8b0c8'; x.fillRect(0,0,w,h); for(let i=0;i<160;i++){ const xx=rand(0,w); x.strokeStyle=`rgba(${rand(60,220)},${rand(60,200)},${rand(100,230)},${rand(.1,.35)})`; x.lineWidth=rand(1,5); x.beginPath(); x.moveTo(xx,0); for(let y=0;y<=h;y+=32) x.lineTo(xx+Math.sin(y*.02+i)*6,y); x.stroke(); } },{strength:3}); }
/* the tardigrade (water bear) — the small ones walk the fiber, the giant one ends the chapter */
/* ---------- the TARDIGRADE, built like the real animal (water bear):
   one chubby barrel body with 4 soft segments + a blunt head, wrinkled see-through-ish cuticle with the dark gut
   showing inside, 8 stubby legs (the back pair points BACKWARD like the real one), each foot with curved hook claws,
   a round mouth ring at the tip of the snout with stylets inside, two tiny dark eye spots. ---------- */
function tardSkinTex(){ return texSet('tardSkin2',512,(x,w,h)=>{
    const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#d8c4a4'); g.addColorStop(1,'#c4aa86'); x.fillStyle=g; x.fillRect(0,0,w,h);
    for(let i=0;i<9000;i++){ const v=rand(-18,18)|0; x.fillStyle=`rgba(${120+v},${96+v},${70+v},${rand(.05,.16)})`; x.fillRect(rand(0,w),rand(0,h),rand(1,3),rand(1,3)); }
    for(let i=0;i<70;i++){ const y=rand(0,h); x.strokeStyle=`rgba(90,64,40,${rand(.12,.3)})`; x.lineWidth=rand(1,2.5); x.beginPath(); x.moveTo(0,y); for(let X=0;X<=w;X+=16) x.lineTo(X,y+Math.sin(X*.02+i)*rand(2,6)); x.stroke(); }
  },{strength:3.4,height:(x,w,h)=>{ x.fillStyle='#808080'; x.fillRect(0,0,w,h);
    // fine transverse folds (the cuticle wrinkles around the body) + little bumps
    for(let i=0;i<70;i++){ const y=rand(0,h), a=rand(.18,.38); x.strokeStyle=`rgba(0,0,0,${a})`; x.lineWidth=rand(1.5,4); x.beginPath(); x.moveTo(0,y); for(let X=0;X<=w;X+=16) x.lineTo(X,y+Math.sin(X*.02+i)*rand(2,6)); x.stroke(); x.strokeStyle=`rgba(255,255,255,${a*.8})`; x.lineWidth=1.5; x.beginPath(); x.moveTo(0,y+3); for(let X=0;X<=w;X+=16) x.lineTo(X,y+3+Math.sin(X*.02+i)*4); x.stroke(); }
    for(let i=0;i<1600;i++){ const r=rand(1,3.5); const gg=x.createRadialGradient(0,0,0,0,0,r); const px=rand(0,w),py=rand(0,h); x.save(); x.translate(px,py); gg.addColorStop(0,'rgba(255,255,255,.35)'); gg.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=gg; x.fillRect(-r,-r,r*2,r*2); x.restore(); }
  }}); }
function tardBodyGeo(){ return GC('tardBody2',()=>{
  const P=[[0,-5.0],[.42,-4.92],[.76,-4.65],[.95,-4.15],[.9,-3.62],[1.04,-3.05],[1.08,-2.5],[.99,-1.96],[1.1,-1.4],[1.12,-.88],[1.02,-.34],[1.06,.12],[.98,.5],[.8,.82],[0,.9]];
  const g=new THREE.LatheGeometry(P.map(p=>new THREE.Vector2(p[0],p[1])),40); g.rotateX(Math.PI/2);
  const pos=g.attributes.position, C=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){ let x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i); if(y<0) y*=.78; else y*=.92; x*=1.06; pos.setXYZ(i,x,y+.98,z);
    // the gut: a darker brown band you can see through the belly + sides (real ones show their food)
    const gut=Math.max(0,1-Math.abs(y+.05)/.7)*Math.max(0,1-Math.abs(z+2.1)/2.6); const k=1-gut*.32; C[i*3]=k; C[i*3+1]=k*.94; C[i*3+2]=k*.86; }
  g.setAttribute('color',new THREE.BufferAttribute(C,3)); g.computeVertexNormals(); return g; }); }
function tardHeadGeo(){ return GC('tardHead2',()=>{
  const P=[[0,-.55],[.86,-.5],[.95,-.2],[.9,.15],[.76,.48],[.56,.74],[.38,.9],[.25,.98],[0,1.0]];
  const g=new THREE.LatheGeometry(P.map(p=>new THREE.Vector2(p[0],p[1])),36); g.rotateX(Math.PI/2);
  const pos=g.attributes.position; for(let i=0;i<pos.count;i++){ let y=pos.getY(i); if(y<0) y*=.8; else y*=.9; pos.setY(i,y); }
  g.computeVertexNormals(); return g; }); }
/* a stubby leg (lobopod): soft cone with 3 folds, from the hip down to the foot */
function tardLegGeo(){ return GC('tardLeg2',()=>{
  const P=[[0,.15],[.36,.12],[.38,0],[.33,-.16],[.36,-.3],[.3,-.45],[.32,-.58],[.25,-.72],[.12,-.8],[0,-.82]].reverse();   // bottom to top = normals face out
  const g=new THREE.LatheGeometry(P.map(p=>new THREE.Vector2(p[0],p[1])),18); g.computeVertexNormals(); return g; }); }
function tardClawGeo(){ return GC('tardClaw2',()=>{ const c=new THREE.QuadraticBezierCurve3(V3(0,0,0),V3(0,-.22,.05),V3(0,-.26,.26)); return new THREE.TubeGeometry(c,8,.022,6,false); }); }
function makeTardigrade(o={}){
  const g=new THREE.Group(); const T=tardSkinTex(); const tx=repeatSet(T,7,4);
  const skin=rimify(new THREE.MeshPhysicalMaterial({color:col(o.color||0xd8c2a8).multiplyScalar(.78),vertexColors:true,roughness:.7,map:tx.map,normalMap:tx.normalMap,normalScale:new THREE.Vector2(2.4,2.4),sheen:col(0x4a3a28),clearcoat:.15,clearcoatRoughness:.7}),0xffe2c0,.28,2.8);
  const headSkin=skin.clone(); headSkin.vertexColors=false; headSkin.onBeforeCompile=skin.onBeforeCompile;
  const clawM=new THREE.MeshPhysicalMaterial({color:col(0x5a4630),roughness:.3,clearcoat:.8});
  const body=new THREE.Group(); g.add(body);
  const trunk=mesh(tardBodyGeo(),skin,0,0,0); body.add(trunk); const segs=[trunk];
  const head=new THREE.Group(); head.position.set(0,.98,.62); body.add(head);
  head.add(mesh(tardHeadGeo(),headSkin,0,0,0));
  // mouth: a ring of lips at the snout tip, dark inside, stylets in the throat
  const mouth=new THREE.Group(); mouth.position.set(0,-.08,.98); head.add(mouth);
  const lipM=new THREE.MeshPhysicalMaterial({color:col(0xb89470),roughness:.5,clearcoat:.3});
  mouth.add(mesh(GC('tdLip2',()=>new THREE.TorusGeometry(.17,.05,10,24)),lipM,0,0,0));
  mouth.add(mesh(GC('tdHole2',()=>new THREE.CircleGeometry(.15,20)),mat(0x1a0c06,{roughness:.9}),0,0,-.02,false));
  const stylets=[]; for(let i=0;i<2;i++){ const st=mesh(GC('tdSty2',()=>{ const c=new THREE.ConeGeometry(.02,.45,6); c.rotateX(Math.PI/2); return c; }),mat(0xe8dcc8,{roughness:.3}),(i?1:-1)*.05,0,-.15,false); mouth.add(st); stylets.push(st); }
  // eye spots: tiny dark pigment cups just behind the snout
  for(const sd of [-1,1]){ const e=sph(.055,new THREE.MeshPhysicalMaterial({color:col(0x1a0c08),roughness:.25,clearcoat:.6}),sd*.5,.32,.42,10,8,false); e.scale.set(.055,.04,.034); head.add(e); }
  // legs: 3 pairs underneath, the 4th pair at the back end pointing backward
  const legs=[];
  const LP=[[.82,-.15,-.0],[.86,-.2,-1.25],[.86,-.2,-2.5],[.55,.05,-4.55]];
  for(let i=0;i<4;i++) for(const sd of [-1,1]){ const lg=new THREE.Group(); const [lx,ly,lz]=LP[i]; lg.position.set(sd*lx,.98+ly-.2,lz); body.add(lg);
    const leg=mesh(tardLegGeo(),headSkin,0,0,0); lg.add(leg);   // (the body material uses vertex colours, legs have none = they were black)
    if(i===3){ lg.rotation.x=-1.0; } else { lg.rotation.z=sd*.28; }
    for(let k=0;k<4;k++){ const cl=mesh(tardClawGeo(),clawM,(k-1.5)*.09,-.76,(k%2)*.04-.02,false); cl.rotation.y=(k-1.5)*.18; lg.add(cl); }
    lg.userData={sd,i,rx0:lg.rotation.x,rz0:lg.rotation.z}; legs.push(lg); }
  g.userData={body,head,mouth,stylets,legs,segs,skin,phase:Math.random()*10};
  return g;
}
function animateTardigrade(td,t,walk=1,mouthOpen=0){
  const U=td.userData; const p=t*2.0+U.phase;
  // the slow, clumsy "bear" walk: legs paddle in a wave front to back, the body rolls a little side to side
  U.legs.forEach(l=>{ const D=l.userData, ph=p-D.i*1.1+(D.sd>0?Math.PI:0); if(D.i===3){ l.rotation.x=D.rx0+Math.sin(ph)*.25*walk; return; }
    l.rotation.x=D.rx0+Math.sin(ph)*.42*walk; l.rotation.z=D.rz0+D.sd*Math.max(0,Math.cos(ph))*.18*walk; });
  U.body.position.y=Math.abs(Math.sin(p))*.05*walk; U.body.rotation.z=Math.sin(p)*.035*walk; U.body.rotation.x=Math.sin(p*2)*.012*walk;
  U.head.rotation.y=Math.sin(t*.6+U.phase)*.22; U.head.rotation.x=Math.sin(t*.9)*.07-mouthOpen*.1;
  U.mouth.scale.setScalar(1+mouthOpen*1.4); U.stylets.forEach((s,i)=>{ s.position.z=-.15+mouthOpen*.35+Math.sin(t*6+i)*.02*mouthOpen; });
}
defineLevel('tiny',{
  title:'the tiny-verse',
  env:{fly:true,swim:true,fx:{exposure:1.1,saturation:1.18,contrast:1.05,bloomStrength:.35,bloomThreshold:1.1,aoRadius:3,aoStrength:.6,vignette:.45,temp:-.1,aberr:.003,grain:.04},music:'tiny',reverb:.55,amb:[['tiny',.12],['tinyHi',.015]],ambEvents:[['microChirp',4],['whale',11]],near:.1,far:4000,speed:5},
  async build(scene,lv){
    const FOG=0x0e2a3a;
    scene.background=col(FOG);
    const bgM=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{t:WIND.time},vertexShader:SKY_VS,
      fragmentShader:`uniform float t; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5); }
      float n(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ vec3 d=normalize(vDir); vec3 top=vec3(0.10,0.45,0.55), bot=vec3(0.06,0.02,0.12), mid=vec3(0.035,0.13,0.2);
        vec3 c=d.y>0.0?mix(mid,top,pow(d.y,1.4)):mix(mid,bot,pow(-d.y,.8));
        float cl=n(d*3.0+vec3(t*0.02,0.0,0.0))*0.6+n(d*7.0-vec3(0.0,t*0.03,0.0))*0.4; c+=vec3(0.1,0.25,0.3)*pow(cl,3.0)*max(0.2,d.y+0.5);
        c+=vec3(0.25,0.9,1.0)*pow(max(d.y,0.0),12.0)*0.8;
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`});
    const bg=new THREE.Mesh(new THREE.SphereGeometry(3500,48,24),bgM); bg.renderOrder=-10; bg.frustumCulled=false; scene.add(bg); lv.bg=bg;
    lv.envMap=makeEnv({top:0x2aa0b0,horizon:0x0c3040,bottom:0x08040e,intensity:1,lights:[{x:0,y:40,z:0,w:30,h:30,c:0x9affff,k:3},{x:30,y:-10,z:20,w:10,h:10,c:0xff7ae0,k:1.5}]});
    const rig=makeRig(scene,{sun:1.6,sunColor:0xbff8ff,hemi:.7,sky:0x5ad8e8,ground:0x3a1850,dir:V3(.15,1,.25),span:60,dist:200,far:500});
    rig.sun.shadow.bias=-.001;
    lv.sunWorld=V3(80,3000,300);
    // --- the giant fiber you float beside ---
    const ft=fiberTex(), fr=repeatSet(ft,6,30);
    const fiberM=rimify(new THREE.MeshPhysicalMaterial({color:col(0xc8b8e0),roughness:.45,map:fr.map,normalMap:fr.normalMap,normalScale:new THREE.Vector2(2,2),clearcoat:.6,transparent:true,opacity:.92}),0x7af0ff,.5,3);
    const fiber=mesh(new THREE.CylinderGeometry(14,14,1400,40,1,true),fiberM,0,0,0); fiber.rotation.set(Math.PI/2,0,.5); fiber.position.set(-40,-30,-120); scene.add(fiber); lv.fiber=fiber;
    const fiber2=mesh(new THREE.CylinderGeometry(9,9,1400,32,1,true),fiberM,0,0,0); fiber2.rotation.set(.4,0,1.2); fiber2.position.set(120,60,-300); scene.add(fiber2);
    addSolid(lv,fiber,'cyl',{r:14.6,h:700}); addSolid(lv,fiber2,'cyl',{r:9.6,h:700});
    for(let i=0;i<30;i++){ const f=cyl(.6,.3,rand(20,60),fiberM,0,0,0,8); const along=rand(-400,300); const a=rand(0,6.28); f.position.set(Math.cos(a)*14,along,Math.sin(a)*14); f.lookAt(f.position.clone().multiplyScalar(2)); f.rotateX(Math.PI/2); fiber.add(f); }
    // --- salt crystals ---
    const crys=new THREE.MeshPhysicalMaterial({color:col(0xe8f8ff),roughness:.04,metalness:0,transmission:.0,transparent:true,opacity:.35,clearcoat:1,envMapIntensity:2,depthWrite:false,side:THREE.DoubleSide});
    lv.subjects=[];
    for(const [x,y,z,s] of [[90,-40,-160,38],[-160,50,-260,55],[60,110,-420,70],[-90,-110,-90,30]]){ const c=mesh(new THREE.BoxGeometry(s,s,s),crys,x,y,z,false); c.rotation.set(rand(0,1),rand(0,1),rand(0,1)); scene.add(c); const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(s,s,s)),new THREE.LineBasicMaterial({color:col(0xbff8ff),transparent:true,opacity:.5})); c.add(e); lv.subjects.push({obj:c,name:'crystal',r:s*.7}); addSolid(lv,c,'box',{min:V3(-s/2,-s/2,-s/2),max:V3(s/2,s/2,s/2)}); }
    // --- dust grains + pollen ---
    const dustM=new THREE.MeshStandardMaterial({color:col(0x8a7a6a),roughness:.95,normalMap:TX.concrete().normalMap});
    for(let i=0;i<14;i++){ const s=rand(8,26); const d=mesh(crumbGeo(200+i,s),dustM,rand(-300,300),rand(-150,150),rand(-600,100)); scene.add(d); lv.subjects.push({obj:d,name:'dust',r:s,spin:V3(rand(-.05,.05),rand(-.05,.05),rand(-.05,.05))}); solidAuto(lv,d,{k:.8}); }
    const pollenM=rimify(new THREE.MeshStandardMaterial({color:col(0xf0b830),roughness:.6}),0xffe066,.6);
    for(let i=0;i<9;i++){ const p=new THREE.Group(); const R=rand(6,11); p.add(sph(R,pollenM,0,0,0,32,24)); for(let k=0;k<60;k++){ const d=V3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize(); const sp=mesh(GC('pSpike',()=>{ const c=new THREE.ConeGeometry(.5,3,6); c.translate(0,1.5,0); return c; }),pollenM,d.x*R,d.y*R,d.z*R,false); sp.quaternion.setFromUnitVectors(V3(0,1,0),d); sp.scale.setScalar(R/8); p.add(sp); } p.position.set(rand(-250,250),rand(-100,140),rand(-500,60)); scene.add(p); lv.subjects.push({obj:p,name:'pollen',r:R*1.3,spin:V3(rand(-.1,.1),rand(-.1,.1),0)}); addSolid(lv,p,'sphere',{r:R+1.2}); }
    await nextFrame();
    // --- bacteria colonies (instanced glowing rods) ---
    const bacM=rimify(new THREE.MeshPhysicalMaterial({color:col(0x7aff9a),roughness:.25,transparent:true,opacity:.82,clearcoat:1,emissive:col(0x1a6a2a),emissiveIntensity:.8}),0xbaffc8,1.6);
    const rodG=mergeGeos([new THREE.CylinderGeometry(1,1,3,16,1,true),new THREE.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2).translate(0,1.5,0),new THREE.SphereGeometry(1,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2).translate(0,-1.5,0)]);
    const NB=dq(80,160,320,480,700); lv.bac=new THREE.InstancedMesh(rodG,bacM,NB); lv.bacData=[];
    const colonies=[V3(30,10,-60),V3(-60,-20,-140),V3(110,40,-230),V3(-20,70,-330),V3(-140,-60,-40)];
    for(let i=0;i<NB;i++){ const c=colonies[i%colonies.length]; const p=c.clone().add(V3(rand(-25,25),rand(-18,18),rand(-25,25))); lv.bacData.push({p,base:p.clone(),rot:new THREE.Euler(rand(0,6),rand(0,6),rand(0,6)),s:rand(.8,1.6),ph:rand(0,10),flee:V3()}); }
    lv.bac.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(lv.bac);
    colonies.forEach(c=>lv.subjects.push({pos:c,name:'bacteria',r:25}));
    // --- diatoms (iridescent glass discs) ---
    const diaT=canvasTex(256,256,(x,w,h)=>{ x.fillStyle='#223'; x.fillRect(0,0,w,h); x.strokeStyle='#dff'; x.lineWidth=2; for(let i=1;i<9;i++){ x.beginPath(); x.arc(128,128,i*14,0,7); x.stroke(); } for(let i=0;i<48;i++){ const a=i/48*Math.PI*2; x.beginPath(); x.moveTo(128,128); x.lineTo(128+Math.cos(a)*124,128+Math.sin(a)*124); x.stroke(); } for(let r=1;r<9;r++) for(let i=0;i<r*8;i++){ const a=i/(r*8)*Math.PI*2+r; x.fillStyle='#9ff'; x.beginPath(); x.arc(128+Math.cos(a)*r*14+7,128+Math.sin(a)*r*14,2.5,0,7); x.fill(); } });
    const diaM=iridescent(new THREE.MeshPhysicalMaterial({color:col(0xc8f8ff),map:diaT,roughness:.1,clearcoat:1,transparent:true,opacity:.85,side:THREE.DoubleSide}));
    const diaSideM=iridescent(new THREE.MeshPhysicalMaterial({color:col(0xa8e0f0),roughness:.15,clearcoat:1,transparent:true,opacity:.8}));  // plain glass rim: the ring texture on the side made a moire grid
    lv.diatoms=[];
    for(let i=0;i<12;i++){ const d=new THREE.Group(); const s=rand(5,11); d.add(mesh(GC('diaDisc',()=>new THREE.CylinderGeometry(1,1,.25,48)),[diaSideM,diaM,diaM],0,0,0)); d.children[0].scale.set(s,s,s); const rim=mesh(GC('diaRim',()=>new THREE.TorusGeometry(1,.08,8,48)),diaM,0,0,0,false); rim.rotation.x=Math.PI/2; rim.scale.setScalar(s); d.add(rim);
      d.position.set(rand(-220,220),rand(-90,120),rand(-450,40)); d.rotation.set(rand(0,3),rand(0,3),rand(0,3)); scene.add(d); lv.diatoms.push({obj:d,spin:rand(-.3,.3)}); lv.subjects.push({obj:d,name:'diatom',r:s}); solidAuto(lv,d,{k:.92}); }
    // --- paramecia (slipper-shaped swimmers with beating cilia) ---
    const parM=rimify(new THREE.MeshPhysicalMaterial({color:col(0x9ad8ff),roughness:.2,transparent:true,opacity:.55,clearcoat:1,depthWrite:false,emissive:col(0x0a2a4a),emissiveIntensity:.6}),0xc8f0ff,1.8,2.2);
    const nucM=new THREE.MeshStandardMaterial({color:col(0x6a4ab8),emissive:col(0x3a1a8a),emissiveIntensity:.8,roughness:.5});
    lv.paras=[];
    for(let i=0;i<7;i++){ const g=new THREE.Group(); const s=rand(1.6,2.6); g.scale.setScalar(s);
      g.add(mesh(GC('paraBody',()=>{ const q=new THREE.SphereGeometry(1,40,24), p=q.attributes.position, v=new THREE.Vector3(); for(let k=0;k<p.count;k++){ v.fromBufferAttribute(p,k); const groove=Math.exp(-Math.pow(v.x-.5,2)*8)*Math.max(0,v.z*.5+.3)*.35; p.setXYZ(k,v.x*1.7-groove,v.y*1.4,v.z*4.8+Math.sin(v.x*2)*.3); } q.computeVertexNormals(); return q; }),parM,0,0,0,false));
      g.add(sph(.8,nucM,0,.1,.4,16,12,false)); g.add(sph(.35,nucM,.4,-.2,-1.2,12,8,false));
      const ciliaPos=[]; for(let k=0;k<dq(80,120,200,260,320);k++){ const a=rand(0,6.28), z=rand(-1,1); const x0=Math.cos(a)*1.72*Math.sqrt(1-z*z*.9), y0=Math.sin(a)*1.42*Math.sqrt(1-z*z*.9), zz=z*4.8; ciliaPos.push(x0,y0,zz,x0*1.25,y0*1.25,zz-.3); }
      const cg=new THREE.BufferGeometry(); cg.setAttribute('position',new THREE.Float32BufferAttribute(ciliaPos,3)); const cil=new THREE.LineSegments(cg,new THREE.LineBasicMaterial({color:col(0xc8f0ff),transparent:true,opacity:.5})); g.add(cil);
      const path={c:V3(rand(-150,150),rand(-60,80),rand(-380,-20)),r:rand(40,90),sp:rand(.05,.12)*(Math.random()<.5?-1:1),ph:rand(0,6.28),tilt:rand(-.4,.4)};
      g.userData={path,cil,t:0}; scene.add(g); lv.paras.push(g); lv.subjects.push({obj:g,name:'paramecium',r:s*5}); solidAuto(lv,g,{k:.85});
    }
    // --- amoebas (wobbling blobs) ---
    lv.amoebas=[];
    for(let i=0;i<3;i++){ const am=new THREE.Group(); const s=rand(10,16);
      const amM=rimify(wobble(new THREE.MeshPhysicalMaterial({color:col(pick([0xff9ab8,0xffb870,0xd89aff])),roughness:.3,transparent:true,opacity:.6,clearcoat:1,depthWrite:false}),.25,.8),0xffd8e8,1.4);
      am.add(mesh(new THREE.SphereGeometry(1,48,32),amM,0,0,0,false)); am.children[0].scale.set(s,s*.7,s*1.2);
      for(let k=0;k<4;k++){ const pd=mesh(new THREE.SphereGeometry(1,24,16),amM,0,0,0,false); const d=V3(rand(-1,1),rand(-.5,.5),rand(-1,1)).normalize(); pd.position.copy(d.multiplyScalar(s*.9)); pd.scale.setScalar(s*rand(.35,.5)); am.add(pd); }
      am.add(sph(s*.28,new THREE.MeshStandardMaterial({color:col(0x5a2a6a),emissive:col(0x2a0a3a),roughness:.5}),s*.1,0,0,20,14,false));
      am.position.set(rand(-200,200),rand(-80,80),rand(-400,-60)); scene.add(am); lv.amoebas.push(am); lv.subjects.push({obj:am,name:'amoeba',r:s*1.3}); solidAuto(lv,am,{k:.72}); }
    // --- bacteriophages clinging to colonies ---
    const phM=new THREE.MeshPhysicalMaterial({color:col(0xd8d8e8),metalness:.3,roughness:.3,clearcoat:1});
    const phG=mergeGeos([new THREE.IcosahedronGeometry(1,0).translate(0,2.6,0),new THREE.CylinderGeometry(.22,.22,2,8).translate(0,1,0),...[0,1,2,3,4,5].map(k=>{ const l=new THREE.CylinderGeometry(.06,.06,1.6,5); l.translate(0,-.8,0); l.rotateZ(.9); l.rotateY(k*Math.PI/3); return l; })]);
    const NP=dq(8,12,24,36,50); lv.phages=new THREE.InstancedMesh(phG,phM,NP); const dm=new THREE.Object3D();
    for(let i=0;i<NP;i++){ const c=colonies[i%colonies.length]; dm.position.copy(c).add(V3(rand(-30,30),rand(-20,20),rand(-30,30))); dm.rotation.set(rand(0,6),rand(0,6),rand(0,6)); dm.scale.setScalar(rand(.8,1.3)); dm.updateMatrix(); lv.phages.setMatrixAt(i,dm.matrix); }
    scene.add(lv.phages);
    // --- small tardigrades walking the fiber ---
    lv.tards=[];
    for(let i=0;i<3;i++){ const td=makeTardigrade(); td.scale.setScalar(rand(7,11)); fiber.add(td); solidAuto(lv,td,{k:.8}); td.userData.along=rand(-300,100); td.userData.ang=rand(0,6.28); td.userData.sp=rand(1.5,3); lv.tards.push(td); lv.subjects.push({obj:td,name:'tardigrade',r:18}); }
    // --- THE GIANT (hidden in the fog until the end) ---
    lv.giant=makeTardigrade({color:0xc8b098}); lv.giant.scale.setScalar(260); lv.giant.position.set(0,-200,-2600); lv.giant.visible=false; scene.add(lv.giant); solidAuto(lv,lv.giant,{k:.7});
    lv.giant.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
    buildTinyLife(lv,scene);
    // --- marine snow ---
    const N=dq(800,1500,3000,4500,6500); const pg=new THREE.BufferGeometry(), pp=new Float32Array(N*3), ps=new Float32Array(N);
    for(let i=0;i<N;i++){ pp[i*3]=rand(-400,400); pp[i*3+1]=rand(-250,250); pp[i*3+2]=rand(-700,200); ps[i]=rand(.5,2.5); }
    pg.setAttribute('position',new THREE.BufferAttribute(pp,3)); pg.setAttribute('size',new THREE.BufferAttribute(ps,1));
    lv.snow=new THREE.Points(pg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{t:WIND.time,px:{value:600}},
      vertexShader:`attribute float size; uniform float t,px; varying float vA; void main(){ vec3 p=position; p.y+=sin(t*0.3+position.x*0.05)*3.0; p.x+=cos(t*0.2+position.z*0.04)*3.0; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=size*px/max(1.0,-mv.z); vA=clamp(1.0-(-mv.z)/500.0,0.0,1.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader:`varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d)*vA*0.7; gl_FragColor=vec4(vec3(0.7,1.0,1.0)*a,a); }`}));
    lv.snow.frustumCulled=false; scene.add(lv.snow);
    // fog
    scene.fog=new THREE.FogExp2(col(FOG),.0032);
    lv.fogBase=.0032;
    lv.flyBounds=(p,v)=>{ const lim=[[-320,320],[-200,200],[-650,150]]; ['x','y','z'].forEach((k,i)=>{ if(p[k]<lim[i][0]){ p[k]=lim[i][0]; v[k]=Math.abs(v[k])*.3; } if(p[k]>lim[i][1]){ p[k]=lim[i][1]; v[k]=-Math.abs(v[k])*.3; } }); };
    lv.col.bounds=null;
  },
  enter(){ const E=this.env; this.scene.fog.density=this.fogBase; FX.sunWorld=this.sunWorld; FX.rays=.45; FX.raysColor.set(.6,1,1); FX.raysDecay=.975; },
  update(dt,t){
    const lv=this; WIND.time.value=t;
    const dm=_tmpObj;
    // bacteria drift + flee when the giant arrives
    const fleeing=lv.fleeing||0;
    for(let i=0;i<lv.bacData.length;i++){ const b=lv.bacData[i]; b.p.set(b.base.x+Math.sin(t*.3+b.ph)*3,b.base.y+Math.cos(t*.25+b.ph)*2,b.base.z+Math.sin(t*.2+b.ph*2)*3); if(fleeing){ b.flee.addScaledVector(V3(b.base.x*.002,.02,.05),dt*fleeing*60); b.p.add(b.flee); } b.rot.x+=dt*.1; b.rot.y+=dt*.07; dm.position.copy(b.p); dm.rotation.copy(b.rot); dm.scale.set(b.s,b.s*1.3,b.s); dm.updateMatrix(); lv.bac.setMatrixAt(i,dm.matrix); }
    lv.bac.instanceMatrix.needsUpdate=true;
    for(const d of lv.diatoms){ d.obj.rotation.y+=dt*d.spin; d.obj.rotation.x+=dt*d.spin*.3; if(fleeing) d.obj.position.z+=dt*fleeing*30; }
    for(const s of lv.subjects){ if(s.spin&&s.obj){ s.obj.rotation.x+=s.spin.x*dt; s.obj.rotation.y+=s.spin.y*dt; } }
    for(const p of lv.paras){ const P=p.userData.path; P.ph+=dt*P.sp*(1+fleeing*3); const a=P.ph; const pos=V3(P.c.x+Math.cos(a)*P.r,P.c.y+Math.sin(a*2)*P.r*.2+Math.sin(a)*P.r*P.tilt,P.c.z+Math.sin(a)*P.r);
      if(p.userData.curious && !fleeing){ const pl=PLAYER.pos; const d=pos.distanceTo(pl); pos.lerp(V3(pl.x+Math.cos(t*.5)*14,pl.y+3,pl.z-18),smooth(1-Math.min(1,d/120))*.9); }
      p.lookAt(pos.clone().add(pos.clone().sub(p.position).multiplyScalar(10))); p.position.lerp(pos,Math.min(1,dt*2));
      p.rotation.z+=Math.sin(t*2)*.01; const cl=p.userData.cil; cl.rotation.z=Math.sin(t*14)*.05; cl.scale.set(1+Math.sin(t*20)*.03,1,1); }
    for(const a of lv.amoebas){ a.rotation.y+=dt*.05; a.children.forEach((c,i)=>{ if(i>0&&i<5) c.scale.setScalar(c.scale.x*(1+Math.sin(t*.8+i)*.002)); }); }
    for(const td of lv.tards){ const U=td.userData; U.along+=dt*U.sp; if(U.along>600) U.along=-600; td.position.set(Math.cos(U.ang)*14,U.along,Math.sin(U.ang)*14); td.quaternion.setFromUnitVectors(V3(0,1,0),V3(Math.cos(U.ang),0,Math.sin(U.ang))); td.rotateY(Math.PI/2); animateTardigrade(td,t,1); }
    if(lv.giant.visible) animateTardigrade(lv.giant,t*.35,.6,lv.giantMouth||0);
    updateTinyLife(lv,dt,t);
    lv.snow.material.uniforms.px.value=renderer.domElement.height*.5;
  }
});
const _tmpObj=new THREE.Object3D();

