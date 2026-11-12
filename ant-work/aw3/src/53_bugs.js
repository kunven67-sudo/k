/* ================================================================
   THE ARENA BUGS (Part 2) — a praying mantis, a tarantula and an
   emperor scorpion, built from real anatomy: every leg has its real
   joints (coxa, femur, patella, tibia, metatarsus, tarsus), the
   tarantula is covered in thousands of hairs, the scorpion's armor is
   overlapping plates with granules, the mantis has compound eyes with
   the dark "pupil" spot and veined wings.
   Sizes are YOUR meters after the fruit shrank you (they're huge).
   ================================================================ */
/* --- textures: color + bumps baked on canvases, normal map from the bumps --- */
function bugNormalFromHeight(hc,strength=2){ const w=hc.width,h=hc.height, src=hc.getContext('2d').getImageData(0,0,w,h).data;
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'), out=x.createImageData(w,h), o=out.data;
  const H=(i,j)=>src[(((j+h)%h)*w+((i+w)%w))*4]/255;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){ const dx=(H(i+1,j)-H(i-1,j))*strength, dy=(H(i,j+1)-H(i,j-1))*strength, l=Math.hypot(dx,dy,1), k=(j*w+i)*4;
    o[k]=(-dx/l*.5+.5)*255; o[k+1]=(-dy/l*.5+.5)*255; o[k+2]=(1/l*.5+.5)*255; o[k+3]=255; }
  x.putImageData(out,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; }
function bugTex(key,size,draw,heightDraw,strength,rep=[1,1]){
  return GC('bugtex_'+key,()=>{ const c=document.createElement('canvas'); c.width=c.height=size; draw(c.getContext('2d'),size);
    const map=new THREE.CanvasTexture(c); map.encoding=THREE.sRGBEncoding; map.wrapS=map.wrapT=THREE.RepeatWrapping; map.repeat.set(rep[0],rep[1]); map.anisotropy=4;
    const hc=document.createElement('canvas'); hc.width=hc.height=size; heightDraw(hc.getContext('2d'),size);
    const nm=bugNormalFromHeight(hc,strength); nm.repeat.set(rep[0],rep[1]); return {map,nm}; }); }
const blotch=(c,s,n,cols,r0,r1,a0=.1,a1=.35)=>{ for(let i=0;i<n;i++){ const x=Math.random()*s,y=Math.random()*s,r=rand(r0,r1); const g=c.createRadialGradient(x,y,0,x,y,r); const cc=pick(cols); g.addColorStop(0,cc.replace('A',rand(a0,a1).toFixed(2))); g.addColorStop(1,cc.replace('A','0')); c.fillStyle=g; c.fillRect(x-r,y-r,r*2,r*2); } };
const dots=(c,s,n,col_,r0,r1)=>{ c.fillStyle=col_; for(let i=0;i<n;i++){ c.beginPath(); c.arc(Math.random()*s,Math.random()*s,rand(r0,r1),0,7); c.fill(); } };
/* mantis: leafy green with faint lighter veins and tiny pits */
function mantisSkin(){ return bugTex('mantis',512,(c,s)=>{ c.fillStyle='#62773a'; c.fillRect(0,0,s,s); blotch(c,s,110,['rgba(120,140,70,A)','rgba(70,80,35,A)','rgba(150,140,80,A)','rgba(110,90,50,A)'],20,90);
    c.strokeStyle='rgba(190,220,120,.12)'; for(let i=0;i<40;i++){ c.lineWidth=rand(.5,1.5); c.beginPath(); c.moveTo(Math.random()*s,0); c.bezierCurveTo(Math.random()*s,s*.3,Math.random()*s,s*.6,Math.random()*s,s); c.stroke(); } dots(c,s,1400,'rgba(40,60,20,.25)',.4,1.1); },
  (c,s)=>{ c.fillStyle='#808080'; c.fillRect(0,0,s,s); dots(c,s,2200,'rgba(40,40,40,.5)',.5,1.4); blotch(c,s,60,['rgba(255,255,255,A)'],10,40,.05,.15); },2.2,[2,2]); }
/* mantis wings (tegmina): leathery green, a strong main vein + a net of small veins */
function mantisWingTex(){ return GC('bugwing',()=>{ const c=document.createElement('canvas'); c.width=256; c.height=1024; const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,256,0); g.addColorStop(0,'#6d8444'); g.addColorStop(.5,'#83985a'); g.addColorStop(1,'#62783c'); x.fillStyle=g; x.fillRect(0,0,256,1024);
  x.strokeStyle='rgba(60,90,30,.6)'; x.lineWidth=3; x.beginPath(); x.moveTo(90,0); x.bezierCurveTo(100,300,110,700,128,1024); x.stroke();
  x.lineWidth=1.2; for(let i=0;i<34;i++){ const y=i*30+rand(-6,6); x.beginPath(); x.moveTo(95+y*.03,y); x.quadraticCurveTo(170,y+30,256,y+rand(40,70)); x.stroke(); x.beginPath(); x.moveTo(95+y*.03,y); x.quadraticCurveTo(40,y+20,0,y+rand(30,50)); x.stroke(); }
  x.strokeStyle='rgba(60,90,30,.25)'; x.lineWidth=.7; for(let i=0;i<500;i++){ const px=Math.random()*256, py=Math.random()*1024; x.beginPath(); x.moveTo(px,py); x.lineTo(px+rand(-12,12),py+rand(-12,12)); x.stroke(); }
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t; }); }
/* compound eye: tiny hexagon facets + the dark "pseudopupil" */
function compoundEyeTex(base,dark){ return GC('bugeye'+base,()=>{ const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d'); x.fillStyle=base; x.fillRect(0,0,256,256);
  const r=4; for(let j=0;j<256/(r*1.5)+1;j++) for(let i=0;i<256/(r*1.73)+1;i++){ const cx=i*r*1.73+(j%2)*r*.86, cy=j*r*1.5; x.strokeStyle='rgba(0,0,0,.25)'; x.lineWidth=.8; x.beginPath(); for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+Math.PI/6; x[k?'lineTo':'moveTo'](cx+Math.cos(a)*r,cy+Math.sin(a)*r); } x.closePath(); x.stroke(); }
  const g=x.createRadialGradient(128,140,2,128,140,30); g.addColorStop(0,dark); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t; }); }
/* tarantula: dense short hair skin (the long hairs are real geometry on top) */
function tarantulaSkin(base,tip){ return bugTex('tar'+base,512,(c,s)=>{ c.fillStyle=base; c.fillRect(0,0,s,s);
    for(let i=0;i<9000;i++){ const x=Math.random()*s, y=Math.random()*s, l=rand(3,11); c.strokeStyle=Math.random()<.45?tip:'rgba(10,6,3,.5)'; c.globalAlpha=rand(.3,.8); c.lineWidth=rand(.5,1.2); c.beginPath(); c.moveTo(x,y); c.lineTo(x+rand(-1.5,1.5),y+l); c.stroke(); } c.globalAlpha=1; },
  (c,s)=>{ c.fillStyle='#777'; c.fillRect(0,0,s,s); for(let i=0;i<9000;i++){ const x=Math.random()*s, y=Math.random()*s; c.strokeStyle=Math.random()<.5?'#bbb':'#333'; c.lineWidth=rand(.5,1.2); c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+rand(3,10)); c.stroke(); } },3,[2,2]); }
/* scorpion: glossy black armor with granules */
function scorpionSkin(key,base,gran){ return bugTex('sc'+key,512,(c,s)=>{ c.fillStyle=base; c.fillRect(0,0,s,s); blotch(c,s,70,['rgba(60,45,30,A)','rgba(0,0,0,A)','rgba(30,40,40,A)'],15,70); dots(c,s,gran,'rgba(90,75,55,.35)',1,2.6); },
  (c,s)=>{ c.fillStyle='#606060'; c.fillRect(0,0,s,s); for(let i=0;i<gran;i++){ const x=Math.random()*s,y=Math.random()*s,r=rand(1.2,3.2); const g=c.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,'#fff'); g.addColorStop(1,'rgba(96,96,96,0)'); c.fillStyle=g; c.fillRect(x-r,y-r,r*2,r*2); } },3.5,[2,2]); }
function chitinMat(tex,o={}){
  const m=new THREE.MeshPhysicalMaterial({color:col(o.tint||0xffffff),map:tex.map,normalMap:tex.nm,normalScale:new THREE.Vector2(o.bump||1,o.bump||1),roughness:o.rough!=null?o.rough:.45,
    clearcoat:o.coat!=null?o.coat:.6,clearcoatRoughness:o.coatRough!=null?o.coatRough:.25,emissive:col(0x000000)});
  if(o.sheen){ m.sheen=col(o.sheen); m.sheenRoughness=.7; }
  return m;
}
/* --- geometry --- */
/* a tapered limb segment along +x (0..len) with a slight bulge and rounded joint ends */
function segGeo(len,r0,r1,bulge=0,rad=12,flat=1){
  return GC('sg'+len.toFixed(2)+'_'+r0.toFixed(3)+'_'+r1.toFixed(3)+'_'+bulge+'_'+flat+'_'+rad,()=>{ const pts=[], N=14;
    for(let i=0;i<=N;i++){ const t=i/N; let r=lerp(r0,r1,t)*(1+bulge*Math.sin(t*Math.PI)); if(t<.08) r*=.75+t/.08*.25; if(t>.92) r*=.75+(1-t)/.08*.25; pts.push(new THREE.Vector2(Math.max(.003,r),t*len)); }
    const g=new THREE.LatheGeometry(pts,rad); g.rotateZ(-Math.PI/2); if(flat!==1) g.scale(1,flat,1); g.computeVertexNormals(); g.computeBoundingBox(); return g; }); }
function ell(rx,ry,rz,m,x=0,y=0,z=0,seg=28){ const s=mesh(GC('ell'+seg,()=>new THREE.SphereGeometry(1,seg,Math.round(seg*.7))),m,x,y,z); s.scale.set(rx,ry,rz); return s; }
/* real hairs (setae): instanced thin cones sticking out of a surface */
const _hq=new THREE.Quaternion(), _hm=new THREE.Matrix4(), _hs=new THREE.Vector3(), _hy=new THREE.Vector3(0,1,0);
function hairMesh(n,m,place){ const geo=GC('hair',()=>{ const c=new THREE.ConeGeometry(1,1,4,1,true); c.translate(0,.5,0); return c; });
  const im=new THREE.InstancedMesh(geo,m,n); const p=new THREE.Vector3(), d=new THREE.Vector3();
  for(let i=0;i<n;i++){ const o=place(i,p,d); _hq.setFromUnitVectors(_hy,d.normalize()); _hs.set(o.thick,o.len,o.thick); _hm.compose(p,_hq,_hs); im.setMatrixAt(i,_hm); }
  im.castShadow=false; im.receiveShadow=true; return im; }
/* hairs along a limb segment (+x), leaning toward the tip */
function hairSeg(group,len,r0,r1,n,hl,m){ group.add(hairMesh(n,m,(i,p,d)=>{ const t=Math.random(), a=Math.random()*Math.PI*2, r=lerp(r0,r1,t)*.95;
  p.set(t*len,Math.cos(a)*r,Math.sin(a)*r); d.set(rand(.6,1.2),Math.cos(a),Math.sin(a)); return {len:hl*rand(.6,1.3),thick:hl*.035}; })); }
/* hairs over an ellipsoid */
function hairEll(group,cx,cy,cz,rx,ry,rz,n,hl,m,lean){ group.add(hairMesh(n,m,(i,p,d)=>{ const u=Math.random()*2-1, a=Math.random()*Math.PI*2, q=Math.sqrt(1-u*u);
  const nx=q*Math.cos(a), ny=u, nz=q*Math.sin(a); p.set(cx+nx*rx*.97,cy+ny*ry*.97,cz+nz*rz*.97); d.set(nx/rx,ny/ry,nz/rz).normalize(); if(lean) d.add(lean).normalize(); return {len:hl*rand(.5,1.4),thick:hl*.03}; })); }
/* a jointed leg: coxa (yaw) then a chain of segments, each bending at its joint */
function bugLeg(parent,o){
  const coxa=new THREE.Group(); coxa.position.copy(o.at); coxa.rotation.y=o.yaw; parent.add(coxa);
  let par=coxa; const J=[];
  o.segs.forEach((sg,i)=>{ const j=new THREE.Group(); if(i) j.position.x=o.segs[i-1].len; j.rotation.z=sg.a; par.add(j);
    const sm=mesh(segGeo(sg.len,sg.r0,sg.r1,sg.bulge||0,10,sg.flat||1),sg.m||o.m); j.add(sm); j.userData.len=sg.len;
    if(o.hair&&sg.hair) hairSeg(j,sg.len,sg.r0,sg.r1,sg.hair,o.hairLen,o.hairM);
    J.push(j); par=j; });
  return {coxa,J,yaw0:o.yaw,a0:o.segs.map(s=>s.a),ph:o.ph||0,side:o.side};
}
const legYaw=(sd,f)=>sd>0?-f:Math.PI+f;   // f>0 = pointing forward (bugs face +z)
function makeBug(kind){
  const root=new THREE.Group(); root.name='bug_'+kind;
  const body=new THREE.Group(); root.add(body);
  const B={kind,root,body,legs:[],atk:null,atkK:0,strikeK:0,walkK:0,ph:0,dead:0,hurtT:0,mats:[],baseY:0};
  root.userData.bug=B;
  if(kind==='mantis'){
    const sk=mantisSkin(), g=chitinMat(sk,{rough:.5,coat:.35,bump:.7}), gl=chitinMat(sk,{tint:0xd8dcb0,rough:.6,coat:.25,bump:.6}), dark=chitinMat(sk,{tint:0x8a8a60,rough:.55,coat:.25});
    B.mats=[g,gl,dark]; B.r=1.15; B.h=3.1; B.speed=3.1; B.hp=100;
    // abdomen: 6 broad flat segments, wider in the middle
    const abd=new THREE.Group(); abd.position.set(0,1.0,-.45); abd.rotation.x=-.1; body.add(abd); B.abd=abd;
    for(let i=0;i<6;i++){ const w=.42+Math.sin((i+1)/7*Math.PI)*.2; abd.add(ell(w,.28-i*.012,.3,g,0,-i*.03,-i*.42,24)); abd.add(ell(w*.92,.08,.26,gl,0,-.22-i*.03,-i*.42,16)); }
    // wings: two long leathery tegmina lying over the abdomen, veined
    const wingM=new THREE.MeshPhysicalMaterial({map:mantisWingTex(),roughness:.45,clearcoat:.3,transparent:true,opacity:.94,side:THREE.DoubleSide,normalMap:sk.nm,normalScale:new THREE.Vector2(.3,.3)});
    for(const sd of [-1,1]){ const w=mesh(GC('mwing2',()=>{ const c=new THREE.PlaneGeometry(.55,2.6,6,20); const p=c.attributes.position; for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i); const t=(y+1.3)/2.6; p.setX(i,x*(.55+.45*Math.sin(t*Math.PI))); p.setZ(i,-Math.abs(x)*.25); } c.rotateX(-Math.PI/2); c.computeVertexNormals(); return c; }),wingM,sd*.17,.3,-1.3); w.rotation.z=sd*.12; w.rotation.y=sd*.03; abd.add(w); }
    body.add(ell(.36,.3,.55,g,0,1.05,0,24));   // the thorax where the walking legs sit
    // the long neck (prothorax), leaning up and forward, wider at the front where the blades sit
    const thx=new THREE.Group(); thx.position.set(0,1.12,.25); thx.rotation.x=.6; body.add(thx); B.thx=thx;
    thx.add(mesh(GC('mprox',()=>{ const pts=[]; for(let i=0;i<=16;i++){ const t=i/16; pts.push(new THREE.Vector2(.075+.045*Math.pow(Math.sin(t*Math.PI*.9),2)+(t>.75?(t-.75)*.45:0),t*1.6)); } const c=new THREE.LatheGeometry(pts,14); c.scale(1,1,.8); c.computeVertexNormals(); return c; }),g));
    // the head: wide triangle, two big compound eyes on the top corners, 3 ocelli, thin antennae, mouthparts
    const head=new THREE.Group(); head.position.set(0,1.68,.02); thx.add(head); B.head=head;
    const hdG=new THREE.Group(); hdG.rotation.x=-.6+.35; head.add(hdG);
    hdG.add(ell(.42,.24,.17,gl,0,0,.06,24));
    hdG.add(mesh(GC('mface',()=>{ const c=new THREE.ConeGeometry(.3,.42,3,1); c.rotateX(Math.PI); c.rotateY(Math.PI); c.scale(1.2,1,.5); c.computeVertexNormals(); return c; }),gl,0,-.2,.1));
    const eyeM=new THREE.MeshPhysicalMaterial({map:compoundEyeTex('#9aa86a','rgba(20,25,10,.9)'),roughness:.12,clearcoat:1,clearcoatRoughness:.05});
    for(const sd of [-1,1]){ const e=ell(.13,.17,.12,eyeM,sd*.38,.09,.08,24); e.rotation.y=sd*.5; e.rotation.z=sd*-.3; hdG.add(e);
      const ant=new THREE.Group(); ant.position.set(sd*.07,.14,.18); ant.rotation.set(-.9,sd*.25,sd*.35); hdG.add(ant);
      const a1=mesh(segGeo(.7,.012,.008,0,5),dark); a1.rotation.z=Math.PI/2; ant.add(a1);
      const a2=new THREE.Group(); a2.position.y=.7; a2.rotation.x=-.4; ant.add(a2); const a3=mesh(segGeo(.7,.008,.004,0,5),dark); a3.rotation.z=Math.PI/2; a2.add(a3); }
    for(const x of [-.06,0,.06]) hdG.add(ell(.022,.022,.015,new THREE.MeshPhysicalMaterial({color:col(0x2a1a0a),roughness:.1,clearcoat:1}),x,.15,.17,10));
    for(const sd of [-1,1]){ const mand=ell(.06,.04,.09,dark,sd*.06,-.4,.13,12); mand.rotation.y=sd*.4; hdG.add(mand); }
    // raptorial forelegs: long coxa, thick flattened femur with two rows of spines, spined tibia ending in a hook
    B.arms=[];
    for(const sd of [-1,1]){ const sh=new THREE.Group(); sh.position.set(sd*.15,1.38,.08); thx.add(sh);
      const up=new THREE.Group(); sh.add(up); const cx=mesh(segGeo(.85,.085,.07,.1,10),g); cx.rotation.z=-Math.PI/2; up.add(cx);
      const fem=new THREE.Group(); fem.position.y=-.85; up.add(fem); const fm=mesh(segGeo(1.05,.075,.06,.45,12,.6),gl); fm.rotation.z=Math.PI/2; fem.add(fm);
      for(let row=0;row<2;row++) for(let i=0;i<7;i++){ const sp=mesh(GC('mspk'+(i%2),()=>{ const c=new THREE.ConeGeometry(.022,i%2?.13:.2,5); c.translate(0,.08,0); return c; }),dark,(row?.035:-.035),.15+i*.12,-.07); sp.rotation.x=-2.3; fem.add(sp); }
      const tib=new THREE.Group(); tib.position.y=1.05; fem.add(tib); const tm=mesh(segGeo(.72,.05,.035,.1,10,.7),gl); tm.rotation.z=-Math.PI/2; tib.add(tm);
      for(let i=0;i<6;i++){ const sp=mesh(GC('mspk2',()=>{ const c=new THREE.ConeGeometry(.018,.12,5); c.translate(0,.06,0); return c; }),dark,0,-.12-i*.1,.05); sp.rotation.x=2.3; tib.add(sp); }
      const hook=mesh(GC('mhook',()=>new THREE.TorusGeometry(.08,.016,6,10,Math.PI*.8)),dark,0,-.74,.06); hook.rotation.y=Math.PI/2; tib.add(hook);
      B.arms.push({sd,sh,up,fem,tib}); }
    // walking legs: middle + hind (thin, long, knees up high)
    for(const sd of [-1,1]) [[-.1,1.25,0],[-.9,1.55,.5]].forEach(([f,L,ph],i)=>{ B.legs.push(bugLeg(body,{m:g,at:V3(sd*.2,1.0,.05-i*.35),yaw:legYaw(sd,f),side:sd,ph:(ph+(sd>0?.5:0))%1,
      segs:[{len:.25,r0:.07,r1:.06,a:.1},{len:L,r0:.055,r1:.045,a:.85,bulge:.1},{len:L*1.1,r0:.04,r1:.03,a:-2.05},{len:.4,r0:.025,r1:.018,a:.5}]})); });
  }
  else if(kind==='spider'){
    // a big tarantula: rusty-brown hair everywhere, darker at the knees
    const sk=tarantulaSkin('#140e0a','rgba(120,100,80,.7)'), skD=tarantulaSkin('#0c0806','rgba(90,75,60,.7)');
    const fur=chitinMat(sk,{rough:.95,coat:0,bump:1.2,sheen:0x7a6a58}), furD=chitinMat(skD,{rough:.95,coat:0,bump:1.2,sheen:0x6a5440});
    const hairM=new THREE.MeshStandardMaterial({color:col(0x6a5a48),roughness:.85}), hairD=new THREE.MeshStandardMaterial({color:col(0x4a3a2a),roughness:.9});
    B.mats=[fur,furD]; B.r=1.4; B.h=1.7; B.speed=3.8; B.hp=120;
    const ceph=new THREE.Group(); ceph.position.set(0,1.0,.45); body.add(ceph); B.ceph=ceph;
    ceph.add(ell(.78,.36,.85,fur,0,0,0,32)); ceph.add(ell(.1,.06,.1,furD,0,.33,-.05,12));
    hairEll(ceph,0,0,0,.78,.36,.85,700,.1,hairM,V3(0,0,-.6));
    const eyeM=new THREE.MeshPhysicalMaterial({color:col(0x0a0806),roughness:.04,clearcoat:1});
    const mound=new THREE.Group(); mound.position.set(0,.34,.55); ceph.add(mound); mound.add(ell(.14,.08,.12,furD,0,0,0,14));
    for(const [x,y,z,r] of [[-.05,.06,.07,.035],[.05,.06,.07,.035],[-.11,.04,.05,.025],[.11,.04,.05,.025],[-.1,.06,-.04,.02],[.1,.06,-.04,.02],[-.04,.08,-.06,.018],[.04,.08,-.06,.018]]) mound.add(ell(r,r,r,eyeM,x,y,z,10));
    // chelicerae: two big hairy lumps in front with black curved fangs folded under
    const head=new THREE.Group(); head.position.set(0,.95,1.25); body.add(head); B.head=head; B.fangs=[];
    for(const sd of [-1,1]){ const f=new THREE.Group(); f.position.set(sd*.19,0,0); head.add(f); f.add(ell(.2,.26,.28,furD,0,-.05,0,20)); hairEll(f,0,-.05,0,.2,.26,.28,160,.08,hairD,V3(0,0,.5));
      const fang=mesh(GC('spfang2',()=>{ const pts=[]; for(let i=0;i<=8;i++){ const t=i/8; pts.push(new THREE.Vector2(.05*(1-t)+.004,t*.42)); } const c=new THREE.LatheGeometry(pts,8); c.translate(0,-.42,0); return c; }),new THREE.MeshPhysicalMaterial({color:col(0x080504),roughness:.15,clearcoat:1}),0,-.25,.18); fang.rotation.x=-1.2; f.add(fang); B.fangs.push(f); }
    body.add(ell(.16,.14,.2,furD,0,1.05,-.45,12));   // the waist (pedicel)
    const abd=new THREE.Group(); abd.position.set(0,1.18,-1.3); body.add(abd); B.abd=abd;
    abd.add(ell(1.0,.85,1.2,fur,0,0,0,32)); hairEll(abd,0,0,0,1.0,.85,1.2,1800,.16,hairM,V3(0,0,-.5));
    abd.add(ell(.12,.1,.14,furD,0,-.25,-1.15,10));   // spinnerets
    for(const sd of [-1,1]) B.legs.push(Object.assign(bugLeg(body,{m:fur,hair:true,hairLen:.09,hairM,at:V3(sd*.32,.85,1.15),yaw:legYaw(sd,1.25),side:sd,ph:sd>0?.25:.75,
      segs:[{len:.5,r0:.1,r1:.09,a:.5,hair:40},{len:.45,r0:.09,r1:.08,a:-1.2,hair:35},{len:.35,r0:.08,r1:.07,a:-.9,hair:30}]}),{palp:true}));
    // 8 legs: coxa, femur, patella, tibia, metatarsus, tarsus — thick and hairy
    const LF=[1.0,.4,-.25,-.85];
    for(const sd of [-1,1]) for(let i=0;i<4;i++){ const s=i===3?1.1:i===0?1.05:.95;
      B.legs.push(bugLeg(body,{m:fur,hair:true,hairLen:.14,hairM,at:V3(sd*.5,.92,.8-i*.28),yaw:legYaw(sd,LF[i]),side:sd,ph:((i%2?.5:0)+(sd>0?.5:0))%1,
        segs:[{len:.3*s,r0:.15,r1:.14,a:.3,hair:30},{len:1.15*s,r0:.14,r1:.12,a:.65,bulge:.08,hair:90},{len:.32*s,r0:.12,r1:.11,a:-1.0,m:furD,hair:30},{len:.9*s,r0:.11,r1:.095,a:-.5,hair:70},{len:.8*s,r0:.09,r1:.075,a:-.35,hair:60},{len:.38*s,r0:.075,r1:.06,a:-.2,m:furD,hair:40}]})); }
  }
  else { // emperor scorpion
    const sk=scorpionSkin('body','#140e0a',700), skC=scorpionSkin('claw','#1a120c',1800), skL=scorpionSkin('leg','#3a2616',300);
    const s=chitinMat(sk,{rough:.22,coat:1,coatRough:.12,bump:.8}), sc=chitinMat(skC,{rough:.28,coat:1,coatRough:.15,bump:1.4}), sl=chitinMat(skL,{rough:.35,coat:.8,bump:.6,tint:0xd0a070});
    const amber=chitinMat(skL,{rough:.2,coat:1,tint:0xffb070});
    B.mats=[s,sc,sl,amber]; B.r=1.6; B.h=1.3; B.speed=2.4; B.hp=160;
    // prosoma (carapace) with the eye mound in the middle and eyes on the front corners
    const pro=new THREE.Group(); pro.position.set(0,.75,.75); body.add(pro);
    pro.add(mesh(GC('scpro',()=>{ const c=new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI*.55); c.scale(.82,.38,.8); c.computeVertexNormals(); return c; }),s));
    const eyeM=new THREE.MeshPhysicalMaterial({color:col(0x050403),roughness:.03,clearcoat:1});
    pro.add(ell(.1,.07,.12,s,0,.36,.05,12)); for(const sd of [-1,1]){ pro.add(ell(.045,.045,.045,eyeM,sd*.06,.4,.08,10)); for(let k=0;k<3;k++) pro.add(ell(.025,.025,.025,eyeM,sd*(.62-k*.05),.12,.48+k*.04,8)); }
    // mesosoma: 7 overlapping armor plates with a keel
    for(let i=0;i<7;i++){ const w=.86+Math.sin(i/6*Math.PI)*.12-(i>5?.12:0); const p=mesh(GC('scplate',()=>{ const c=new THREE.SphereGeometry(1,28,12,0,Math.PI*2,0,Math.PI*.6); c.computeVertexNormals(); return c; }),s,0,.72,-i*.42); p.scale.set(w,.36,.3); p.rotation.x=-.08; body.add(p);
      const keel=mesh(segGeo(.32,.02,.02,0,5),s,0,.72+.35,-i*.42+.15); keel.rotation.y=Math.PI/2; body.add(keel); }
    body.add(ell(.8,.18,1.4,sl,0,.48,-1.2,20));   // the paler underside
    for(const sd of [-1,1]) pro.add(ell(.07,.06,.11,sl,sd*.08,.06,.82,10));   // chelicerae
    // pedipalps: femur, patella, then the big claw (manus) with the fixed + moving fingers (toothed)
    B.claws=[];
    for(const sd of [-1,1]){ const sh=new THREE.Group(); sh.position.set(sd*.5,.8,1.35); body.add(sh);
      const a1=mesh(segGeo(.8,.11,.1,.1,12,.8),sc); a1.rotation.y=-Math.PI/2; sh.add(a1);
      const el=new THREE.Group(); el.position.z=.8; sh.add(el); const a2=mesh(segGeo(.75,.13,.12,.15,12,.85),sc); a2.rotation.y=-Math.PI/2; el.add(a2);
      const hand=new THREE.Group(); hand.position.z=.75; el.add(hand);
      hand.add(ell(.27,.2,.42,sc,0,0,.35,28));
      const fing=GC('scfing2',()=>{ const pts=[]; for(let i=0;i<=10;i++){ const t=i/10; pts.push(new THREE.Vector2(.075*(1-t*.85)+.006,t*.75)); } const c=new THREE.LatheGeometry(pts,10); c.rotateX(Math.PI/2); c.scale(1,.75,1); c.computeVertexNormals(); return c; });
      const fixedF=mesh(fing,sc,sd*.09,0,.68); fixedF.rotation.y=-sd*.12; hand.add(fixedF);
      const mov=new THREE.Group(); mov.position.set(-sd*.09,0,.66); hand.add(mov); mov.add(mesh(fing,sc));
      for(let k=0;k<5;k++) mov.add(ell(.015,.015,.015,sl,sd*.05,0,.12+k*.12,6));
      B.claws.push({sd,sh,el,hand,mov}); }
    // metasoma (tail): 5 keeled segments curling up over the back, then the telson bulb + the curved stinger
    const tail=new THREE.Group(); tail.position.set(0,.8,-2.85); body.add(tail); B.tail=[];
    let par=tail;
    for(let i=0;i<6;i++){ const j=new THREE.Group(); j.position.z=i?-(.58+i*.02):0; par.add(j);
      if(i<5){ j.add(mesh(GC('sctail'+i,()=>{ const c=new THREE.CylinderGeometry(.24-i*.012,.26-i*.012,.6+i*.02,8,1); c.rotateX(Math.PI/2); c.translate(0,0,-.3); const p=c.attributes.position; for(let k=0;k<p.count;k++){ const a=Math.atan2(p.getY(k),p.getX(k)); const ridge=1+.08*Math.pow(Math.abs(Math.cos(a*2)),8); p.setX(k,p.getX(k)*ridge); p.setY(k,p.getY(k)*ridge); } c.computeVertexNormals(); return c; }),s)); }
      else { j.add(ell(.25,.22,.34,amber,0,0,-.3,20));
        const sting=mesh(GC('scsting2',()=>{ const pts=[]; for(let k=0;k<=10;k++){ const t=k/10; pts.push(new THREE.Vector2(.09*(1-t)+.004,t*.55)); } const c=new THREE.LatheGeometry(pts,10); const p=c.attributes.position; for(let k=0;k<p.count;k++){ const y=p.getY(k); p.setZ(k,p.getZ(k)+y*y*.9); } c.computeVertexNormals(); return c; }),new THREE.MeshPhysicalMaterial({color:col(0x0c0604),roughness:.12,clearcoat:1,emissive:col(0)}),0,-.05,-.58); sting.rotation.x=-2.0; j.add(sting); B.stinger=sting; }
      B.tail.push(j); par=j; }
    const LF=[.55,.15,-.3,-.75];
    for(const sd of [-1,1]) for(let i=0;i<4;i++) B.legs.push(bugLeg(body,{m:sl,at:V3(sd*.6,.62,.85-i*.38),yaw:legYaw(sd,LF[i]),side:sd,ph:((i%2?.5:0)+(sd>0?.5:0))%1,
      segs:[{len:.2,r0:.09,r1:.085,a:.2},{len:.7+i*.06,r0:.085,r1:.075,a:.75,bulge:.1,flat:.8},{len:.3,r0:.075,r1:.07,a:-1.0},{len:.55+i*.04,r0:.065,r1:.055,a:-.55,flat:.85},{len:.32,r0:.045,r1:.03,a:-.4}]}));
  }
  root.traverse(o=>{ if(o.isMesh&&!o.isInstancedMesh){ o.castShadow=true; o.receiveShadow=true; } });
  // stand it on the ground: lift the body until the lowest leg tip touches y=0
  root.updateMatrixWorld(true); let minY=1e9; const tip=new THREE.Vector3();
  for(const L of B.legs){ if(L.palp) continue; const last=L.J[L.J.length-1]; tip.set(last.userData.len,0,0); last.localToWorld(tip); minY=Math.min(minY,tip.y); }
  B.baseY=-minY; body.position.y=B.baseY;
  return root;
}
function bugHurt(root){ root.userData.bug.hurtT=.18; }
function animateBug(root,dt,t){
  const B=root.userData.bug; if(!B) return;
  B.hurtT=Math.max(0,B.hurtT-dt);
  for(const m of B.mats) if(m.emissive) m.emissive.setRGB(B.hurtT>0?.5:0,B.hurtT>0?.04:0,B.hurtT>0?.02:0);
  if(B.dead>0){ // flipped on its back, legs curling in
    B.dead=Math.min(1,B.dead+dt*1.4); const k=smooth(B.dead);
    B.body.rotation.z=lerp(0,Math.PI*.93,k); B.body.position.y=lerp(B.baseY,B.h*.6,k);
    for(const L of B.legs) L.J.forEach((j,i)=>{ j.rotation.z=L.a0[i]+(i?-.5*k:.6*k)+Math.sin(t*22+L.ph*6+i)*.06*(1-k); });
    return; }
  // gait: each leg lifts and swings in its turn
  B.ph+=dt*B.walkK*(B.kind==='spider'?3.2:2.4);
  for(const L of B.legs){ const p=(B.ph+L.ph)%1, sw=Math.sin(p*Math.PI*2), up=Math.max(0,Math.sin(p*Math.PI*2))*B.walkK;
    L.coxa.rotation.y=L.yaw0+sw*.22*B.walkK*(L.side>0?1:-1);
    L.J.forEach((j,i)=>{ j.rotation.z=L.a0[i]+(i===1?up*.35:i===2?up*.3:0)+(L.palp?Math.sin(t*1.3+L.side)*.08:0); }); }
  const w=B.atkK, s=B.strikeK;
  B.body.position.y=B.baseY+Math.sin(t*2.2)*.02;
  if(B.kind!=='mantis'&&B.kind!=='spider'&&B.kind!=='scorpion') return;   // small bugs (ants, roaches): legs only
  if(B.kind==='mantis'){
    B.body.rotation.z=Math.sin(t*1.5)*.04; B.thx.rotation.x=.6-w*.3+s*.45;
    if(B.head) B.head.rotation.y=Math.sin(t*.6)*.3*(1-w);
    for(const A of B.arms){ const which=B.atk==='double'?(A.sd<0?1:(s>.5?1:0)):1, sk=s*which;
      A.up.rotation.x=lerp(-1.65,-2.35,w)+sk*1.05; A.fem.rotation.x=lerp(1.835,2.05,w)+sk*.22; A.tib.rotation.x=lerp(-.25,-1.57,w)+sk*.78; A.sh.rotation.z=A.sd*(.1+w*.1); }
  } else if(B.kind==='spider'){
    const crouch=B.atk==='leap'?w:0, rear=B.atk==='bite'?w:0, butt=B.atk==='web'?w:0;
    B.body.position.y-=crouch*.4; B.body.rotation.x=-rear*.4+s*.3*(B.atk==='bite'?1:0)-(B.air||0)*.15;
    B.abd.rotation.x=butt*-.5; for(const f of B.fangs) f.rotation.x=rear*.5-s*.8*(B.atk==='bite'?1:0)+Math.sin(t*3)*.04;
    if(B.air) for(const L of B.legs) L.J.forEach((j,i)=>{ j.rotation.z=L.a0[i]+(i===1?-.4:i===2?.3:0); });
  } else {
    const sting=B.atk==='sting'?1:0, pinch=B.atk==='pincer'?1:0, sweep=B.atk==='sweep'?1:0;
    for(const C of B.claws){ C.sh.rotation.y=C.sd*(.45-pinch*w*.3)+sweep*C.sd*.4*w; C.sh.rotation.x=-pinch*w*.2+pinch*s*.15; C.el.rotation.y=-C.sd*(1.05-pinch*w*.35-pinch*s*.7); C.hand.rotation.y=C.sd*.25;
      C.mov.rotation.y=-C.sd*(.12+pinch*w*.45-pinch*s*.55)+Math.sin(t*2+C.sd)*.04; }
    const curl=[.95,.55,.5,.55,.6,.65];
    B.tail.forEach((j,i)=>{ j.rotation.x=curl[i]+sting*(w*(i<3?.22:.1)-s*(i<3?.65:.85))+Math.sin(t*1.7+i*.6)*.025; });
    if(B.stinger) B.stinger.material.emissive.setRGB(sting*w*.5,sting*w*.18,0);
  }
}
