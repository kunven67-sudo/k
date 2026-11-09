/* ================================================================
   CREATURES — the macro ant (intro) and Mars alien bugs.
   Real insect anatomy: head w/ compound eyes, elbowed antennae,
   mandibles, 3-part mesosoma, petiole, plated gaster, 6 jointed legs
   with 5-segment tarsi, fine setae.  Tripod gait, eat, groom.
   ================================================================ */
function compoundEyeTex(){
  if(TEXCACHE._ceye) return TEXCACHE._ceye;
  const t=canvasTex(128,128,(x,w,h)=>{ x.fillStyle='#050404'; x.fillRect(0,0,w,h); const r=4; for(let j=0;j<h/(r*1.5)+1;j++) for(let i=0;i<w/(r*1.73)+1;i++){ const cx=i*r*1.73+(j%2)*r*.86, cy=j*r*1.5; const g=x.createRadialGradient(cx-1,cy-1,0,cx,cy,r); g.addColorStop(0,'#3a2a22'); g.addColorStop(.6,'#140c0a'); g.addColorStop(1,'#020101'); x.fillStyle=g; x.beginPath(); for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+Math.PI/6; x.lineTo(cx+Math.cos(a)*r*.95,cy+Math.sin(a)*r*.95); } x.fill(); } },[3,2]);
  TEXCACHE._ceye=t; return t;
}
function chitinTex(){
  return texSet('chitin',256,(x,w,h)=>{ x.fillStyle='#808080'; x.fillRect(0,0,w,h); for(let i=0;i<1600;i++){ const v=110+Math.random()*60|0; x.fillStyle=`rgba(${v},${v},${v},.6)`; x.beginPath(); x.arc(Math.random()*w,Math.random()*h,.5+Math.random()*1.6,0,7); x.fill(); } for(let i=0;i<60;i++){ x.strokeStyle='rgba(60,60,60,.35)'; x.lineWidth=.7; x.beginPath(); let px=Math.random()*w,py=Math.random()*h; x.moveTo(px,py); for(let k=0;k<4;k++){ px+=rand(-10,10); py+=rand(-3,3); x.lineTo(px,py); } x.stroke(); } },{strength:1.6});
}
/* leg: coxa -> femur -> tibia -> tarsus chain. returns {root, femur, tibia, tars[]} */
function insectLeg(side,len,m,thin=1){
  const root=new THREE.Group();
  const cox=mesh(GC('antCox',()=>{ const s=new THREE.SphereGeometry(1,10,8); s.scale(.045,.07,.045); s.translate(0,-.04,0); return s; }),m,0,0,0,false); root.add(cox);
  const femJ=new THREE.Group(); femJ.position.set(side*.03,-.07,0); root.add(femJ);
  const femL=.42*len, tibL=.44*len;
  femJ.add(mesh(GC('antFemL'+femL+thin+side,()=>{ const c=new THREE.CylinderGeometry(.024*thin,.038*thin,femL,10); c.translate(0,femL/2,0); c.rotateZ(-Math.PI/2*side); return c; }),m,0,0,0,false));
  femJ.add(mesh(GC('antKnee2',()=>new THREE.SphereGeometry(.026,10,8)),m,side*femL,0,0,false));
  const tibJ=new THREE.Group(); tibJ.position.set(side*femL,0,0); femJ.add(tibJ);
  tibJ.add(mesh(GC('antTibL'+tibL+thin+side,()=>{ const c=new THREE.CylinderGeometry(.016*thin,.024*thin,tibL,8); c.translate(0,tibL/2,0); c.rotateZ(-Math.PI/2*side); return c; }),m,0,0,0,false));
  tibJ.add(mesh(GC('antSpur',()=>{ const c=new THREE.ConeGeometry(.006,.05,4); c.rotateZ(Math.PI/2); return c; }),m,side*tibL*.96,-.01,0,false));
  const tars=[]; let par=new THREE.Group(); par.position.set(side*tibL,0,0); tibJ.add(par);
  for(let i=0;i<5;i++){ const L=(i===0?.11:.05)*len; const seg=mesh(GC('antTar'+L,()=>{ const c=new THREE.CylinderGeometry(.009,.013,L,6); c.translate(0,L/2,0); c.rotateZ(-Math.PI/2); return c; }),m,0,0,0,false); if(side<0){ seg.rotation.y=Math.PI; } par.add(seg); tars.push(par); const nx=new THREE.Group(); nx.position.set(side*L,0,0); par.add(nx); par=nx; }
  par.add(mesh(GC('antClaw',()=>{ const c=new THREE.ConeGeometry(.005,.03,4); c.rotateZ(Math.PI*.75); return c; }),m,0,-.008,0,false));
  return {root,femJ,tibJ,tars,femL,tibL};
}
/* antenna: scape then elbow then 10-segment funiculus (last 3 form a club) */
function insectAntenna(side,m,len=1){
  const root=new THREE.Group();
  const scL=.36*len;
  root.add(mesh(GC('antScape'+scL,()=>{ const c=new THREE.CylinderGeometry(.012,.016,scL,7); c.translate(0,scL/2,0); return c; }),m,0,0,0,false));
  const elbow=new THREE.Group(); elbow.position.y=scL; root.add(elbow);
  elbow.add(mesh(GC('antElb',()=>new THREE.SphereGeometry(.016,8,6)),m,0,0,0,false));
  const segs=[]; let par=elbow;
  for(let i=0;i<10;i++){ const club=i>=7; const L=(club?.05:.038)*len, r=club?.019:.012; const g=new THREE.Group(); par.add(g);
    const sg=mesh(GC('antFun'+L+r,()=>{ const s=new THREE.SphereGeometry(1,8,6); s.scale(r,L*.62,r); s.translate(0,L*.5,0); return s; }),m,0,0,0,false); g.add(sg);
    segs.push(g); const nx=new THREE.Group(); nx.position.y=L; g.add(nx); par=nx; }
  return {root,elbow,segs};
}
function setae(count,spread,len,rng){ const pos=[]; for(let i=0;i<count;i++){ const p=spread(rng); const n=p.n; pos.push(p.x,p.y,p.z,p.x+n.x*len*(.5+rng()),p.y+n.y*len*(.5+rng()),p.z+n.z*len*(.5+rng())); } const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); return g; }
function makeAnt(o={}){
  const opt=Object.assign({color:0x3a160c,gaster:0x1c0a06,legs:0x2a1008,shine:1,hairs:true,seed:3,alien:null},o);
  const r=RNG(opt.seed);
  const ct=chitinTex();
  const shell=new THREE.MeshPhysicalMaterial({color:col(opt.color),roughness:.4,metalness:0,clearcoat:opt.shine*.7,clearcoatRoughness:.3,normalMap:ct.normalMap,normalScale:new THREE.Vector2(.35,.35),sheen:col(0x3a2418)});
  const gasterM=new THREE.MeshPhysicalMaterial({color:col(opt.gaster),roughness:.32,clearcoat:opt.shine*.8,clearcoatRoughness:.22,normalMap:ct.normalMap,normalScale:new THREE.Vector2(.25,.25)});
  const legM=new THREE.MeshPhysicalMaterial({color:col(opt.legs),roughness:.4,clearcoat:.6,clearcoatRoughness:.3});
  const eyeM=new THREE.MeshPhysicalMaterial({color:0xffffff,map:compoundEyeTex(),roughness:.15,clearcoat:1,clearcoatRoughness:.03});
  const g=new THREE.Group(); const body=new THREE.Group(); body.position.y=.2; g.add(body);
  // gaster: smooth glossy ellipsoid with inset segment sutures
  const gasterJ=new THREE.Group(); gasterJ.position.set(0,.04,-.36); body.add(gasterJ);
  gasterJ.add(mesh(GC('gCore2',()=>{ const q=new THREE.SphereGeometry(1,36,28), p=q.attributes.position, v=new THREE.Vector3(); for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const t=v.z; v.x*=1-.12*Math.max(0,t); v.y*=1-.15*Math.max(0,t); p.setXYZ(i,v.x*.22,v.y*.19+(t<0?t*t*.02:0),v.z*.3); } q.computeVertexNormals(); return q; }),gasterM,0,0,-.12));
  for(let i=0;i<3;i++){ const zz=.08-i*.1; const rr=Math.sqrt(Math.max(0,1-Math.pow((zz)/.3,2))); const ring=mesh(GC('gRing'+i,()=>{ const t=new THREE.TorusGeometry(1,.012,6,40); return t; }),legM,0,0,-.12+zz,false); ring.scale.set(.22*rr+.001,.19*rr+.001,1); gasterJ.add(ring); }
  // petiole + node
  body.add(mesh(GC('antPet',()=>{ const c=new THREE.CylinderGeometry(.03,.04,.14,8); c.rotateX(Math.PI/2); return c; }),shell,0,-.01,-.19));
  body.add(mesh(GC('antNode',()=>{ const s=new THREE.SphereGeometry(1,14,10); s.scale(.05,.075,.04); return s; }),shell,0,.04,-.2));
  // mesosoma: pronotum, mesonotum, propodeum
  const meso=new THREE.Group(); body.add(meso);
  meso.add(mesh(GC('pron',()=>{ const s=new THREE.SphereGeometry(1,20,14); s.scale(.11,.1,.12); return s; }),shell,0,.02,.12));
  meso.add(mesh(GC('mesn',()=>{ const s=new THREE.SphereGeometry(1,20,14); s.scale(.085,.08,.12); return s; }),shell,0,.03,-.0));
  meso.add(mesh(GC('prop',()=>{ const s=new THREE.SphereGeometry(1,16,12); s.scale(.075,.08,.08); return s; }),shell,0,.02,-.1));
  for(const sd of [1,-1]){ const sp=mesh(GC('propSp',()=>{ const c=new THREE.ConeGeometry(.012,.06,5); return c; }),shell,sd*.03,.1,-.12,false); sp.rotation.set(-.6,0,sd*.3); meso.add(sp); }
  // head
  const head=new THREE.Group(); head.position.set(0,.07,.3); head.scale.setScalar(1.25); body.add(head);
  head.add(mesh(GC('antHead',()=>{ const s=new THREE.SphereGeometry(1,28,22), p=s.attributes.position, v=new THREE.Vector3(); for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const back=Math.max(0,-v.z); v.x*=1+.15*back*(1-Math.abs(v.y)); v.z*=1-.12*Math.exp(-v.x*v.x*30)*back; v.y*=.85; p.setXYZ(i,v.x*.13,v.y*.13,v.z*.14); } s.computeVertexNormals(); return s; }),shell,0,0,.02));
  for(const sd of [1,-1]){ const e=mesh(GC('antEye',()=>{ const s=new THREE.SphereGeometry(1,16,12); s.scale(.04,.055,.05); return s; }),eyeM,sd*.11,.02,.04,false); head.add(e); }
  head.add(mesh(GC('clyp',()=>{ const s=new THREE.SphereGeometry(1,14,10); s.scale(.07,.04,.04); return s; }),shell,0,-.03,.14,false));
  const mands=[];
  for(const sd of [1,-1]){ const mj=new THREE.Group(); mj.position.set(sd*.05,-.05,.13); mj.scale.setScalar(1.35); head.add(mj);
    const shape=new THREE.Shape(); shape.moveTo(0,0); shape.quadraticCurveTo(.02*sd,.09,-.05*sd,.14); shape.lineTo(-.075*sd,.12); for(let k=0;k<4;k++){ shape.lineTo(-.06*sd+k*.012*sd,.1-k*.022); shape.lineTo(-.045*sd+k*.012*sd,.095-k*.022); } shape.lineTo(-.02*sd,0); shape.closePath();
    const mg=new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2}); mg.rotateX(Math.PI/2); mg.translate(0,.009,0);
    mj.add(mesh(mg,legM,0,0,0,false)); mands.push(mj); mj.userData.side=sd; }
  const ants=[];
  for(const sd of [1,-1]){ const A=insectAntenna(sd,legM,opt.antLen||1); A.root.position.set(sd*.045,.06,.12); head.add(A.root); ants.push(A); }
  // legs (3 pairs from the mesosoma)
  const legs=[]; const LZ=[.13,.02,-.08], LEN=[.85,.95,1.1];
  for(let i=0;i<6;i++){ const side=i%2===0?1:-1, row=Math.floor(i/2);
    const L=insectLeg(side,LEN[row],legM,1); L.root.position.set(side*.06,-.02,LZ[row]); meso.add(L.root);
    L.side=side; L.row=row; L.tri=((row===1)?(side>0?1:0):(side>0?0:1)); L.baseYaw=[-.7,.1,.75][row]*side; L.root.rotation.y=L.baseYaw; legs.push(L); }
  // setae (fine hairs)
  if(opt.hairs && SETTINGS.detail>=2){
    const hm=new THREE.LineBasicMaterial({color:col(0x8a6a4a),transparent:true,opacity:.55});
    const gH=setae(dq(0,0,90,160,260),rr=>{ const a=rr()*Math.PI*2, b=rr()*Math.PI; const n=V3(Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)); return {x:n.x*.23,y:n.y*.19,z:n.z*.28-.12,n:n.clone().add(V3(0,.3,-.6)).normalize()}; },.07,r);
    const hl=new THREE.LineSegments(gH,hm); gasterJ.add(hl);
    const hH=setae(dq(0,0,40,70,100),rr=>{ const a=rr()*Math.PI*2, b=rr()*Math.PI*.8; const n=V3(Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)); return {x:n.x*.13,y:n.y*.11,z:n.z*.14+.02,n}; },.05,r);
    head.add(new THREE.LineSegments(hH,hm));
  }
  g.userData={body,head,gaster:gasterJ,meso,legs,ants,mands,shell,gasterM,legM,
    A:{gait:0,speed:0,chew:0,chewT:0,antT:r()*10,groom:0,headTilt:0,headDip:0,lastPos:new THREE.Vector3(),look:null,sniff:0}};
  g.traverse(m=>{ if(m.isMesh){ m.castShadow=true; m.receiveShadow=true; } });
  return g;
}
/* per-frame ant animation. A.speed (units/s) drives the tripod gait. */
function animateAnt(ant,dt,t){
  const U=ant.userData, A=U.A;
  A.gait+=dt*A.speed*7.5;
  const moving=A.speed>.02;
  for(const L of U.legs){
    const ph=A.gait+(L.tri?Math.PI:0), s=Math.sin(ph), c=Math.cos(ph);
    const swing=moving?Math.max(0,c):0;
    L.root.rotation.y=L.baseYaw+(moving?s*.35*L.side*-1:0)+(A.groom&&L.row===0?0:0);
    L.femJ.rotation.z=L.side*(.55+swing*.35)+(moving?0:Math.sin(t*.7+L.row)*.02);
    L.tibJ.rotation.z=-L.side*(1.55-swing*.2);
    for(let i=0;i<L.tars.length;i++) L.tars[i].rotation.z=-L.side*(i===0?.5:.12);
  }
  // grooming: front-left leg lifts to the antenna
  if(A.groom>0){ const L=U.legs[0], k=Math.min(1,A.groom); L.femJ.rotation.z=lerp(L.femJ.rotation.z,-1.1,k); L.root.rotation.y=lerp(L.root.rotation.y,-1.2,k); L.tibJ.rotation.z=lerp(L.tibJ.rotation.z,-2.2+Math.sin(t*14)*.25,k); }
  U.body.position.y=.2+(moving?Math.abs(Math.sin(A.gait*2))*.008:0);
  U.body.rotation.z=moving?Math.sin(A.gait)*.03:0;
  U.gaster.rotation.x=Math.sin(t*1.3)*.04+(moving?Math.sin(A.gait*2)*.03:0);
  // head: dip to eat, tilt, sniff
  U.head.rotation.x=damp(U.head.rotation.x,A.headDip,8,dt);
  U.head.rotation.z=damp(U.head.rotation.z,A.headTilt,5,dt);
  U.head.rotation.y=damp(U.head.rotation.y,A.headYaw||0,5,dt);
  // mandibles chew
  if(A.chew>0){ A.chewT+=dt*9; } const open=A.chew>0?(Math.sin(A.chewT)*.5+.5)*.6:.08;
  for(const m of U.mands) m.rotation.y=damp(m.rotation.y,-m.userData.side*open,20,dt);
  // antennae: sweeping search / tapping / grooming
  A.antT+=dt;
  U.ants.forEach((an,i)=>{ const sd=i===0?1:-1;
    const base=A.sniff>0?.9:.35; const sweep=Math.sin(A.antT*(A.sniff>0?7:2.2)+i*1.7);
    an.root.rotation.set(.55+sweep*.2*(A.sniff>0?.6:1),0,-sd*(.55+Math.sin(A.antT*1.3+i)*.12));
    an.elbow.rotation.set(1.0+base*.6+Math.sin(A.antT*3+i)*.2,0,sd*.25);
    an.segs.forEach((s,k)=>{ s.rotation.x=.06+Math.sin(A.antT*4+k*.5+i)*.03; });
    if(A.groom>0 && i===0){ an.root.rotation.x=lerp(an.root.rotation.x,1.2,Math.min(1,A.groom)); an.elbow.rotation.x=lerp(an.elbow.rotation.x,1.9,Math.min(1,A.groom)); }
  });
}

/* ---------- Mars alien bugs (built on the insect rig, but weirder) ---------- */
function makeMarsBug(aggr=false,seed=1){
  const r=RNG(seed*97+3);
  const palette=aggr?[[0x8a1c10,0x3a0a06,0xff4a2a],[0x7a2a8a,0x2a0a3a,0xff3aff]]:[[0x2a6a5a,0x0f2a24,0x6dffd8],[0x6a5a1a,0x2a2206,0xffe066],[0x2a3a8a,0x0a1036,0x7ab0ff]];
  const P=palette[Math.floor(r()*palette.length)];
  const ant=makeAnt({color:P[0],gaster:P[1],legs:P[1],seed:seed,hairs:false,antLen:aggr?.8:1.3});
  const U=ant.userData;
  // glowing spots + crystal spikes on the gaster, extra eyes
  const glow=new THREE.MeshStandardMaterial({color:col(P[2]),emissive:col(P[2]),emissiveIntensity:3,roughness:.3});
  for(let i=0;i<6;i++){ const a=r()*Math.PI*2; const s=mesh(GC('bugSpot',()=>new THREE.SphereGeometry(.03,10,8)),glow,Math.cos(a)*.2,.1+r()*.08,-.1-r()*.25,false); U.gaster.add(s); }
  const cry=new THREE.MeshPhysicalMaterial({color:col(P[2]),roughness:.05,transmission:.0,clearcoat:1,emissive:col(P[2]),emissiveIntensity:.4,transparent:true,opacity:.85});
  for(let i=0;i<(aggr?7:4);i++){ const sp=mesh(GC('bugCry',()=>new THREE.ConeGeometry(.035,.2,5)),cry,(r()-.5)*.2,.2,-.05-r()*.3,false); sp.rotation.set(-.4+r()*.5,0,(r()-.5)*.8); U.gaster.add(sp); }
  for(const sd of [1,-1]) U.head.add(mesh(GC('bugEye2',()=>new THREE.SphereGeometry(.022,10,8)),glow,sd*.06,.09,.08,false));
  if(aggr){ for(const m of U.mands) m.scale.set(1.6,1.6,1.6); }
  ant.userData.bug={aggr,hp:aggr?4:3,maxHp:aggr?4:3,dead:false,glow,baseEm:3,heading:r()*6.28,wanderT:r()*10,atkCd:0,hitFlash:0};
  return ant;
}

