/* ================================================================
   TINYVERSE, PART 2 — the creatures after the giant: a Demodex mite
   (eaten), the skin flake you hide behind, bacterial biofilm
   colonies, Naegleria fowleri, Larry the dust mite, and the
   Paramecium snacks you catch for him with the net.
   ================================================================ */
/* bend a mesh's geometry side to side along its z axis (tails, bodies) */
function wiggleMat(m,amt=.35,freq=.7,speed=6,from=.5,to=-8){
  const prev=m.onBeforeCompile; const U={value:0};
  m.onBeforeCompile=sh=>{ if(prev) prev(sh); sh.uniforms.uT=WIND.time; sh.uniforms.uWig=U;
    sh.vertexShader='uniform float uT; uniform float uWig;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    { float tl=smoothstep(${from.toFixed(2)},${to.toFixed(2)},position.z); transformed.x+=sin(position.z*${freq.toFixed(2)}-uT*${speed.toFixed(2)})*${amt.toFixed(3)}*tl*uWig; }`); };
  const k=m.customProgramCacheKey?m.customProgramCacheKey():''; m.customProgramCacheKey=()=>k+'wig'+amt+freq+speed; m.userData.wig=U; return m;
}
/* ---------- Demodex mite: stubby legs up front, long ringed tail ---------- */
function makeDemodex(){
  const g=new THREE.Group();
  const rt=texSet('demodexRings',[128,512],(x,w,h)=>{ x.fillStyle='#e6d6b6'; x.fillRect(0,0,w,h); for(let j=0;j<h;j+=9){ x.fillStyle='rgba(120,90,60,.45)'; x.fillRect(0,j,w,2.5); x.fillStyle='rgba(255,250,235,.35)'; x.fillRect(0,j+3,w,1.5); } for(let i=0;i<400;i++){ x.fillStyle=`rgba(90,70,50,${Math.random()*.15})`; x.fillRect(Math.random()*w,Math.random()*h,2,2); } },{strength:3});
  const rr=repeatSet(rt,3,6);
  const m=wiggleMat(rimify(new THREE.MeshPhysicalMaterial({color:col(0xf2e4c8),map:rr.map,normalMap:rr.normalMap,roughness:.4,clearcoat:.6,transparent:true,opacity:.94}),0xfff0d8,.8,2.4),.4,.7,7);
  const pts=[[0,-8],[.18,-7.6],[.4,-6.4],[.62,-4.5],[.82,-2.4],[.98,-.6],[1.05,.8],[1,1.9],[.82,2.7],[.6,3.2],[.35,3.55],[0,3.7]].map(p=>new THREE.Vector2(p[0],p[1]));
  const bg=new THREE.LatheGeometry(pts,28); bg.rotateX(Math.PI/2);
  const body=mesh(bg,m,0,0,0,false); g.add(body);
  const legM=new THREE.MeshPhysicalMaterial({color:col(0xd8c49c),roughness:.4,clearcoat:.5});
  const legs=[];
  for(let i=0;i<4;i++) for(const sd of [-1,1]){ const lg=new THREE.Group(); lg.position.set(sd*.8,-.5,2.4-i*.7); g.add(lg);
    lg.add(mesh(GC('dmLeg',()=>{ const c=new THREE.CylinderGeometry(.13,.17,.6,10); c.translate(0,-.3,0); return c; }),legM,0,0,0,false));
    for(const k of [-1,1]){ const cl=mesh(GC('dmClaw',()=>{ const c=new THREE.ConeGeometry(.035,.2,6); c.translate(0,-.1,0); return c; }),mat(0x6a4a2a,{roughness:.3}),k*.05,-.62,.03,false); cl.rotation.x=.5; lg.add(cl); }
    lg.rotation.z=sd*.7; lg.userData={sd,i}; legs.push(lg); }
  for(const sd of [-1,1]){ const pp=mesh(GC('dmPalp',()=>{ const c=new THREE.ConeGeometry(.12,.5,8); c.rotateX(Math.PI/2); return c; }),legM,sd*.2,-.1,3.8,false); g.add(pp); }
  g.userData={legs,mat:m,phase:Math.random()*10};
  return g;
}
function animateDemodex(d,t,k=1){ const U=d.userData; U.mat.userData.wig.value=k; U.legs.forEach(l=>{ l.rotation.x=Math.sin(t*9+U.phase+l.userData.i*1.1+(l.userData.sd>0?Math.PI:0))*.5*k; }); }
/* ---------- dust mite (Larry): fat striated body, eight hairy legs, busy little mouthparts ---------- */
function makeDustMite(){
  const g=new THREE.Group();
  const ct=texSet('miteCuticle',512,(x,w,h)=>{ x.fillStyle='#efe0c4'; x.fillRect(0,0,w,h); x.lineWidth=2.2; for(let i=0;i<70;i++){ x.strokeStyle=`rgba(${150+Math.random()*40|0},${120+Math.random()*30|0},90,.5)`; x.beginPath(); const y0=i*8; for(let k=0;k<=64;k++){ const xx=k*w/64, yy=y0+Math.sin(k*.35+i*.7)*5+Math.sin(k*.11+i)*9; k?x.lineTo(xx,yy):x.moveTo(xx,yy); } x.stroke(); } },{strength:3.5});
  const cr=repeatSet(ct,2,2);
  const bodyM=rimify(new THREE.MeshPhysicalMaterial({color:col(0xf4e4c6),map:cr.map,normalMap:cr.normalMap,normalScale:new THREE.Vector2(1.2,1.2),roughness:.5,clearcoat:.5,clearcoatRoughness:.35,sheen:col(0x806040)}),0xffe8c0,.55,2.2);
  const legM=new THREE.MeshPhysicalMaterial({color:col(0xe2caa0),roughness:.45,clearcoat:.4});
  const hairM=mat(0xc8a878,{roughness:.6});
  const body=new THREE.Group(); g.add(body);
  const idio=mesh(GC('miteBody',()=>{ const q=new THREE.SphereGeometry(1,48,32); q.scale(1.25,.95,1.6); return q; }),bodyM,0,1.25,0); body.add(idio);
  const groove=mesh(GC('miteGroove',()=>new THREE.TorusGeometry(1,.035,8,48)),legM,0,1.3,.45,false); groove.rotation.x=Math.PI/2; groove.scale.set(1.2,1.0,1); body.add(groove);
  // gnathosoma (mouthparts) + chelicerae that open when Larry talks
  const head=new THREE.Group(); head.position.set(0,1.05,1.62); body.add(head);
  head.add(mesh(GC('miteHead',()=>{ const q=new THREE.SphereGeometry(.4,24,18); q.scale(1,.8,1.3); return q; }),bodyM,0,0,0));
  const chel=[]; for(const sd of [-1,1]){ const c=new THREE.Group(); c.position.set(sd*.13,.02,.42); head.add(c); c.add(mesh(GC('miteChel',()=>{ const q=new THREE.CylinderGeometry(.05,.08,.4,10); q.rotateX(Math.PI/2); q.translate(0,0,.18); return q; }),legM,0,0,0,false)); c.add(mesh(GC('miteChelTip',()=>{ const q=new THREE.ConeGeometry(.045,.16,8); q.rotateX(Math.PI/2); q.translate(0,0,.44); return q; }),mat(0x8a6a4a,{roughness:.4}),0,0,0,false)); c.userData.sd=sd; chel.push(c); }
  const palps=[]; for(const sd of [-1,1]){ const p=new THREE.Group(); p.position.set(sd*.28,-.02,.3); head.add(p); p.add(mesh(GC('mitePalp',()=>{ const q=new THREE.CylinderGeometry(.045,.06,.36,8); q.rotateX(Math.PI/2); q.translate(0,0,.16); return q; }),legM,0,0,0,false)); p.rotation.y=sd*.5; palps.push(p); }
  // eight legs, each four segments with bristles and a sucker at the tip
  const legs=[];
  const zs=[1.05,.6,-.45,-.95], out=[.9,.5,-.4,-.85];
  for(let i=0;i<4;i++) for(const sd of [-1,1]){
    const root=new THREE.Group(); root.position.set(sd*1.05,1.05,zs[i]); root.rotation.y=sd*(Math.PI/2)-sd*out[i]; body.add(root);
    let parent=root; const segs=[]; const L=[.5,.55,.48,.36], R=[.11,.09,.07,.05], bend=[-.55,.9,.55,.3];
    for(let k=0;k<4;k++){ const j=new THREE.Group(); if(k) j.position.z=L[k-1]; parent.add(j);
      j.add(mesh(GC('mLeg'+k,()=>{ const c=new THREE.CylinderGeometry(R[k]*.8,R[k],L[k],10); c.rotateX(Math.PI/2); c.translate(0,0,L[k]/2); return c; }),legM,0,0,0,false));
      j.add(mesh(GC('mKnee'+k,()=>new THREE.SphereGeometry(R[k]*1.05,10,8)),legM,0,0,0,false));
      const hair=mesh(GC('mHair',()=>{ const c=new THREE.ConeGeometry(.012,.5,5); c.translate(0,.25,0); return c; }),hairM,0,R[k],L[k]*.6,false); hair.rotation.x=-.9; j.add(hair);
      j.rotation.x=bend[k]; segs.push(j); parent=j; }
    const suck=mesh(GC('mSuck',()=>new THREE.CylinderGeometry(.07,.03,.04,12)),mat(0xb89870,{roughness:.3,clearcoat:1}),0,0,L[3],false); suck.rotation.x=Math.PI/2; parent.add(suck);
    legs.push({root,segs,sd,i,base:root.rotation.y}); }
  // long body bristles
  for(let i=0;i<14;i++){ const a=rand(-.9,.9), z=rand(-1.4,.6); const h=mesh(GC('mBristle',()=>{ const c=new THREE.ConeGeometry(.025,1,5); c.translate(0,.5,0); return c; }),hairM,Math.sin(a)*1.1,1.25+Math.cos(a)*.8,z,false); h.scale.y=rand(1.1,2.2); h.rotation.set(-1.1+rand(-.2,.2),0,-a*.8); body.add(h); }
  for(let i=0;i<4;i++){ const sd=i%2?1:-1; const h=mesh(GC('mBristle'),hairM,sd*.4,1.2,-1.5,false); h.scale.y=rand(2.2,3); h.rotation.set(-2.1,0,sd*.3); body.add(h); }
  g.userData={body,head,chel,palps,legs,talk:0,phase:Math.random()*10};
  return g;
}
function animateDustMite(m,t,dt){
  const U=m.userData; const talking=U.talking?1:0; U.talk=damp(U.talk,talking,8,dt);
  U.body.position.y=Math.sin(t*1.3+U.phase)*.04; U.body.rotation.z=Math.sin(t*.9)*.02;
  const ch=U.talk*(.25+Math.abs(Math.sin(t*14))*.35);
  U.chel.forEach(c=>{ c.rotation.y=c.userData.sd*ch; c.rotation.x=-ch*.3; }); U.palps.forEach((p,i)=>p.rotation.x=Math.sin(t*6+i)*.25*(.3+U.talk));
  U.head.rotation.x=Math.sin(t*1.7)*.05-U.talk*Math.sin(t*9)*.06; U.head.rotation.y=Math.sin(t*.6)*.12;
  U.legs.forEach(L=>{ const w=Math.sin(t*1.5+L.i*.8+(L.sd>0?1:0))*.06; L.root.rotation.y=L.base+w; L.segs[1].rotation.x=.9+Math.sin(t*1.2+L.i)*.05;
    if(L.i===0 && U.talk>.1) { L.segs[1].rotation.x=.9-U.talk*(.35+Math.sin(t*5+L.sd)*.25); }
    // waving: the front leg comes up IN FRONT of him (toward whoever he's facing) and waves side to side
    if(L.i===0 && L.sd>0 && U.wave) { L.root.rotation.y=L.base-.55+Math.sin(t*7)*.32; L.segs[0].rotation.x=-1.15; L.segs[1].rotation.x=-.25+Math.sin(t*7+.6)*.22; L.segs[2].rotation.x=.25; } else if(L.i===0 && L.sd>0){ L.segs[0].rotation.x=-.55; L.segs[2].rotation.x=.55; } });
}
/* ---------- Naegleria fowleri: a pinkish amoeba with a big lobe, granules, and "food cups" ---------- */
function makeNaegleria(){
  const g=new THREE.Group();
  const m=rimify(wobble(new THREE.MeshPhysicalMaterial({color:col(0xff8a9a),roughness:.25,transparent:true,opacity:.55,clearcoat:1,depthWrite:false,emissive:col(0x3a0612),emissiveIntensity:.7}),.2,.9),0xff4a6a,1.9,2.2);
  const main=mesh(new THREE.SphereGeometry(1,48,32),m,0,0,0,false); main.scale.set(1.4,.95,1.15); g.add(main);
  const lobe=mesh(new THREE.SphereGeometry(1,40,28),m,0,-.05,1.25,false); lobe.scale.set(.95,.7,.9); g.add(lobe);
  const lobes=[lobe]; for(const [x,y,z,s] of [[-1.1,.2,-.3,.55],[.9,-.3,-.7,.5],[.2,.55,-.9,.45]]){ const l=mesh(new THREE.SphereGeometry(1,24,16),m,x,y,z,false); l.scale.setScalar(s); g.add(l); lobes.push(l); }
  const nuc=sph(.38,new THREE.MeshPhysicalMaterial({color:col(0x6a2a8a),roughness:.4,transparent:true,opacity:.85,emissive:col(0x2a0a3a)}),-.2,.05,-.1,24,18,false); g.add(nuc);
  nuc.add(sph(.2,emissiveMat(0xaa1a3a,1.4),0,0,0,16,12,false));
  const vac=sph(.26,new THREE.MeshPhysicalMaterial({color:col(0xd8f0ff),roughness:.05,transparent:true,opacity:.35,clearcoat:1}),.6,.3,-.4,20,14,false); g.add(vac);
  const gr=new THREE.InstancedMesh(GC('nGran',()=>new THREE.SphereGeometry(.05,8,6)),new THREE.MeshStandardMaterial({color:col(0x5a1a2a),emissive:col(0x3a0610),roughness:.5}),70); const o=new THREE.Object3D();
  for(let i=0;i<70;i++){ const d=V3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(rand(.2,.85)); o.position.set(d.x*1.3,d.y*.85,d.z*1.1); o.scale.setScalar(rand(.35,.8)); o.updateMatrix(); gr.setMatrixAt(i,o.matrix); } g.add(gr);
  // amoebastomes ("food cups") on the surface
  const cupM=mat(0x7a1020,{roughness:.3,emissive:col(0x3a0008)});
  for(let i=0;i<6;i++){ const d=V3(rand(-1,1),rand(-.4,.6),rand(-.2,1)).normalize(); const c=mesh(GC('nCup',()=>new THREE.TorusGeometry(.11,.035,8,18)),cupM,d.x*1.3,d.y*.9,d.z*1.1,false); c.lookAt(c.position.clone().multiplyScalar(2)); g.add(c); }
  g.userData={main,lobes,phase:Math.random()*10,state:'idle',home:V3(),t:0};
  return g;
}
function animateNaegleria(n,t,dt){ const U=n.userData; const k=U.state==='lunge'?3:1;
  U.lobes.forEach((l,i)=>{ const s=1+Math.sin(t*1.3*k+i*1.7+U.phase)*.12; l.scale.setScalar((i?[.55,.5,.45][i-1]:.9)*s); });
  U.lobes[0].position.z=1.25+Math.sin(t*.8*k)*.25+(U.state==='lunge'?.5:0); n.rotation.y+=dt*.05; }
/* ---------- skin flake: a big curled translucent sheet of dead skin cells ---------- */
function corneoTex(){
  return texSet('corneocytes',512,(x,w,h)=>{
    const N=90, pts=[]; for(let i=0;i<N;i++) pts.push([Math.random()*w,Math.random()*h]);
    const img=x.createImageData(w,h), d=img.data;
    for(let j=0;j<h;j++) for(let i=0;i<w;i++){ let d1=1e9,d2=1e9,id=0; for(let k=0;k<N;k++){ for(const ox of [-w,0,w]) for(const oy of [-h,0,h]){ const dx=i-pts[k][0]-ox, dy=j-pts[k][1]-oy, dd=dx*dx+dy*dy; if(dd<d1){ d2=d1; d1=dd; id=k; } else if(dd<d2) d2=dd; } }
      const e=Math.sqrt(d2)-Math.sqrt(d1); const edge=1-smooth(clamp(e/5,0,1)); const tone=.9+((id*37)%13)/13*.12; const q=(j*w+i)*4;
      d[q]=clamp((236*tone)-edge*70,0,255); d[q+1]=clamp((222*tone)-edge*72,0,255); d[q+2]=clamp((198*tone)-edge*70,0,255); d[q+3]=255; }
    x.putImageData(img,0,0);
    for(let i=0;i<500;i++){ x.fillStyle=`rgba(120,100,80,${Math.random()*.12})`; x.beginPath(); x.arc(Math.random()*w,Math.random()*h,Math.random()*3,0,7); x.fill(); }
  },{strength:2.5});
}
function makeSkinFlake(seed=1,size=75){
  const g=new THREE.Group();
  const ct=corneoTex(), cr=repeatSet(ct,1,1); // (alphaMap shares the map's UV repeat in three r128, so keep this at 1)
  const alpha=canvasTex(256,256,(x,w,h)=>{ x.fillStyle='#000'; x.fillRect(0,0,w,h); x.fillStyle='#fff'; x.beginPath(); const r=RNG(seed); for(let i=0;i<=40;i++){ const a=i/40*Math.PI*2; const rr=w*.44*(1+(r()-.5)*.28+Math.sin(a*3+seed)*.08); const px=w/2+Math.cos(a)*rr, py=h/2+Math.sin(a)*rr*.85; i?x.lineTo(px,py):x.moveTo(px,py); } x.fill(); });
  const geo=new THREE.PlaneGeometry(2,2,40,40); const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i); p.setZ(i,.28*x*x-.12*y*y+noise2(x*2+seed,y*2)*.08); } geo.computeVertexNormals();
  const m=rimify(new THREE.MeshPhysicalMaterial({color:col(0xf4ead8),map:cr.map,normalMap:cr.normalMap,alphaMap:alpha,alphaTest:.4,transparent:true,opacity:.86,roughness:.65,clearcoat:.3,side:THREE.DoubleSide,depthWrite:true}),0xfff4e0,.35,2.5);
  const sheet=mesh(geo,m,0,0,0,false); sheet.scale.setScalar(size); g.add(sheet);
  g.userData={sheet,size,seed}; return g;
}
/* ---------- bacterial biofilm colony: slimy mounds and mushroom towers packed with rod bacteria ---------- */
function makeBiofilm(seed=1){
  const g=new THREE.Group(); const r=RNG(seed);
  const slimeM=rimify(new THREE.MeshPhysicalMaterial({color:col(0x9ad86a),roughness:.12,clearcoat:1,transparent:true,opacity:.7,emissive:col(0x1a4a10),emissiveIntensity:.6,depthWrite:false}),0xd8ff9a,1.3,2);
  const base=mesh(GC('bfBase',()=>new THREE.CircleGeometry(1,40)),slimeM,0,.2,0,false); base.rotation.x=-Math.PI/2; base.scale.setScalar(12); g.add(base);
  const tops=[];
  for(let i=0;i<7;i++){ const a=r()*6.28, d=r()*10, h=4+r()*10, w=2+r()*3.5; const x=Math.cos(a)*d, z=Math.sin(a)*d;
    const tower=r()<.55;
    const pts=tower?[[0,0],[w*.9,0],[w*.55,h*.35],[w*.5,h*.7],[w*1.3,h*.8],[w*1.4,h*.92],[w*.9,h],[0,h*1.02]]:[[0,0],[w*1.4,0],[w*1.2,h*.3],[w*.8,h*.6],[w*.3,h*.85],[0,h*.9]];
    const t=mesh(new THREE.LatheGeometry(pts.map(q=>new THREE.Vector2(q[0],q[1])),20),slimeM,x,0,z,false); t.rotation.y=r()*6; g.add(t); tops.push({x,z,h:h*(tower?1:.9),w:w*(tower?1.3:1)}); }
  const rodG=GC('bfRod',()=>new THREE.CylinderGeometry(.22,.22,.9,8));
  const N=dq(80,120,200,260,320); const rods=new THREE.InstancedMesh(rodG,new THREE.MeshStandardMaterial({color:col(0xe8ff6a),emissive:col(0x6a8a10),emissiveIntensity:.9,roughness:.4}),N); const o=new THREE.Object3D();
  for(let i=0;i<N;i++){ const tp=tops[i%tops.length]; const a=r()*6.28, y=r()*tp.h; const rad=tp.w*(.3+r()*.6); o.position.set(tp.x+Math.cos(a)*rad,y,tp.z+Math.sin(a)*rad); o.rotation.set(r()*3,r()*3,r()*3); o.scale.setScalar(.7+r()*.8); o.updateMatrix(); rods.setMatrixAt(i,o.matrix); }
  g.add(rods);
  // a few free bacteria drifting just above
  g.userData={slimeM,phase:r()*6,tops}; return g;
}
/* ---------- Paramecium snacks (little golden ones Larry likes) ---------- */
function makeSnack(){
  const g=new THREE.Group();
  const m=rimify(new THREE.MeshPhysicalMaterial({color:col(0xffd870),roughness:.2,transparent:true,opacity:.75,clearcoat:1,emissive:col(0x6a4a08),emissiveIntensity:.9,depthWrite:false}),0xfff0a0,1.6,2.2);
  g.add(mesh(GC('snackBody',()=>{ const q=new THREE.SphereGeometry(1,28,18); q.scale(1.5,1.2,4.2); return q; }),m,0,0,0,false));
  g.add(sph(.6,emissiveMat(0xff9a2a,1.2),0,.1,.3,12,10,false));
  const cp=[]; for(let k=0;k<70;k++){ const a=rand(0,6.28), z=rand(-1,1); const x0=Math.cos(a)*1.5*Math.sqrt(1-z*z*.9), y0=Math.sin(a)*1.2*Math.sqrt(1-z*z*.9), zz=z*4.2; cp.push(x0,y0,zz,x0*1.3,y0*1.3,zz-.3); }
  const cg=new THREE.BufferGeometry(); cg.setAttribute('position',new THREE.Float32BufferAttribute(cp,3)); const cil=new THREE.LineSegments(cg,new THREE.LineBasicMaterial({color:col(0xfff0b0),transparent:true,opacity:.55})); g.add(cil);
  g.userData={cil,ph:rand(0,6.28),caught:false,vel:V3()}; return g;
}

/* ================= level hookup ================= */
const HUNT={};
function buildTinyLife(lv,scene){
  lv.demodex=makeDemodex(); lv.demodex.scale.setScalar(3.4); lv.demodex.visible=false; scene.add(lv.demodex);
  lv.flake=makeSkinFlake(3,64); lv.flake.visible=false; scene.add(lv.flake);
  lv.bfFlake=makeSkinFlake(6,46); lv.bfFlake.visible=false; scene.add(lv.bfFlake);
  lv.biofilms=[1,2,3].map(i=>{ const b=makeBiofilm(i+10); b.visible=false; scene.add(b); return b; });
  lv.naeg=makeNaegleria(); lv.naeg.scale.setScalar(13); lv.naeg.visible=false; scene.add(lv.naeg);
  lv.larry=makeDustMite(); lv.larry.scale.setScalar(12); lv.larry.visible=false; scene.add(lv.larry);
  lv.larryFlake=makeSkinFlake(9,34); lv.larryFlake.visible=false; scene.add(lv.larryFlake);
  lv.larryLight=new THREE.PointLight(col(0xffe0b0),1.5,120,2); scene.add(lv.larryLight); lv.larryLight.intensity=0;
  lv.naegLight=new THREE.PointLight(col(0xff4a6a),1.8,110,2); scene.add(lv.naegLight); lv.naegLight.intensity=0;
  lv.snacks=[]; for(let i=0;i<7;i++){ const s=makeSnack(); s.scale.setScalar(1.1); s.visible=false; scene.add(s); lv.snacks.push(s); }
  lv.subjects.push({pos:V3(),name:'biofilm',label:'Bacterial biofilm colony',r:30,hunt:true,hide:true});
  lv.subjects.push({obj:lv.naeg,name:'naegleria',label:'Naegleria fowleri',r:22,hunt:true});
  lv.subjects.push({obj:lv.larry,name:'larry',label:'Dust mite (Larry)',r:26,hunt:true});
  // everything here is solid: you swim around it, not through it
  for(const f of [lv.flake,lv.bfFlake,lv.larryFlake]) flakeSolid(lv,f);
  for(const b of lv.biofilms) for(const tp of b.userData.tops) addSolid(lv,b,'ell',{c:V3(tp.x,tp.h*.5,tp.z),a:V3(tp.w*.85,tp.h*.52,tp.w*.85)});
  solidAuto(lv,lv.naeg,{k:.7}); solidAuto(lv,lv.larry,{k:.72}); solidAuto(lv,lv.demodex,{k:.8});
}
const HUNT_LIM=[[-260,260],[-150,150],[-590,90]];
function clampHunt(v){ v.x=clamp(v.x,HUNT_LIM[0][0],HUNT_LIM[0][1]); v.y=clamp(v.y,HUNT_LIM[1][0],HUNT_LIM[1][1]); v.z=clamp(v.z,HUNT_LIM[2][0],HUNT_LIM[2][1]); return v; }
/* lay out the skin flake + everything after it around an anchor (where you were when the giant came) */
function placeTinyLife(lv,anc){
  const f=anc.f.clone().normalize(), up=V3(0,1,0), right=V3(-f.z,0,f.x).normalize();
  const P=clampHunt(anc.pos.clone()); HUNT.anc={pos:P.clone(),f:f.clone(),right:right.clone()};
  lv.flake.visible=true; lv.flake.position.copy(P); lv.flake.lookAt(P.clone().sub(f)); lv.flake.rotateZ(.4);
  // the biofilm colonies grow on a flat flake ledge just below and beside the big one
  const B=clampHunt(P.clone().addScaledVector(f,-30).addScaledVector(right,-34).addScaledVector(up,-26));
  lv.bfFlake.visible=true; lv.bfFlake.position.copy(B); lv.bfFlake.rotation.set(-Math.PI/2,0,.3);
  const offs=[[-14,-8],[12,-4],[0,14]];
  lv.biofilms.forEach((b,i)=>{ b.visible=true; b.rotation.set(0,i*2.1,0); b.position.copy(B).add(V3(offs[i][0],1.5,offs[i][1])); b.scale.setScalar(1.25); });
  const bs=lv.subjects.find(s=>s.name==='biofilm'); bs.pos.copy(B).add(V3(0,8,0)); bs.hide=false;
  lv.naeg.userData.home=clampHunt(P.clone().addScaledVector(right,135).addScaledVector(up,25).addScaledVector(f,40)); lv.naeg.position.copy(lv.naeg.userData.home); lv.naeg.visible=true; lv.naeg.userData.state='idle';
  const L=clampHunt(P.clone().addScaledVector(right,-150).addScaledVector(f,110).addScaledVector(up,-14)); lv.larry.position.copy(L); lv.larry.visible=true; { const dir=f.clone().negate().add(right); lv.larry.rotation.set(0,Math.atan2(dir.x,dir.z),0); }
  lv.larryFlake.visible=true; lv.larryFlake.position.copy(L).add(V3(0,-.4,0)); lv.larryFlake.rotation.set(-Math.PI/2,0,.6);
  lv.larryLight.intensity=1.5; lv.larryLight.position.copy(L).add(V3(0,40,20));
  lv.naegLight.intensity=1.8;
  lv.snacks.forEach((s,i)=>{ s.visible=false; s.userData.caught=false; const a=i/lv.snacks.length*Math.PI*2; s.userData.home=clampHunt(L.clone().add(V3(Math.cos(a)*rand(28,55),rand(-8,22),Math.sin(a)*rand(28,55)))); s.position.copy(s.userData.home); });
  return {P,f,right,up};
}
function hideTinyLife(lv){ for(const o of [lv.demodex,lv.flake,lv.bfFlake,lv.naeg,lv.larry,lv.larryFlake,...lv.biofilms,...lv.snacks]) o.visible=false; lv.larryLight.intensity=lv.naegLight.intensity=0; const bs=lv.subjects.find(s=>s.name==='biofilm'); if(bs) bs.hide=true; }
function updateTinyLife(lv,dt,t){
  if(lv.demodex.visible) animateDemodex(lv.demodex,t,1);
  if(lv.larry.visible) animateDustMite(lv.larry,t,dt);
  const N=lv.naeg; if(N.visible){ animateNaegleria(N,t,dt); const U=N.userData;
    if(U.state==='idle'){ N.position.lerp(U.home.clone().add(V3(Math.sin(t*.3)*12,Math.sin(t*.4)*6,Math.cos(t*.25)*12)),Math.min(1,dt*.5)); }
    lv.naegLight.position.copy(N.position).add(V3(0,10,0)); }
  for(const b of lv.biofilms) if(b.visible) b.userData.slimeM.emissiveIntensity=.5+Math.sin(t*1.2+b.userData.phase)*.15;
  for(const s of lv.snacks){ if(!s.visible) continue; const U=s.userData; U.ph+=dt*.45;
    const goal=U.home.clone().add(V3(Math.cos(U.ph)*10,Math.sin(U.ph*1.7)*4,Math.sin(U.ph)*10));
    const away=s.position.clone().sub(PLAYER.pos); const d=away.length();
    if(d<9){ goal.addScaledVector(away.normalize(),(9-d)*.5); }   // they used to run from you at 22 (the net reaches 16) = an annoying chase
    const v=goal.sub(s.position); const L=v.length(); if(L>.01) U.vel.lerp(v.multiplyScalar(Math.min(1,3.6/L)*1.0),Math.min(1,dt*2));
    s.position.addScaledVector(U.vel,dt); if(U.vel.lengthSq()>.01) s.lookAt(s.position.clone().add(U.vel));
    U.cil.rotation.z=Math.sin(t*16+U.ph)*.06; }
}
/* ---------- objective marker (a diamond on screen that points at the next creature) ---------- */
const MARKER={fn:null,label:'',unit:'µm',lv:null};
function setMarker(fn,label,unit){ MARKER.fn=fn?(typeof fn==='function'?fn:()=>fn):null; MARKER.label=label||''; MARKER.unit=unit||'µm'; MARKER.lv=LV&&LV.name; $('marker').classList.toggle('show',!!fn); $('markerTxt').textContent=MARKER.label; }
const _mk=new THREE.Vector3();
on('tick',()=>{ if(!MARKER.fn) return; const el=$('marker');
  if(G.mode!=='play'||DLG.active||CAM.active||!LV||LV.name!==MARKER.lv){ el.style.opacity=0; return; }
  const p=MARKER.fn(); if(!p){ el.style.opacity=0; return; }
  _mk.copy(p).project(camera); let x=_mk.x, y=_mk.y; const behind=_mk.z>1; if(behind){ x=-x; y=-y; }
  const edge=behind||Math.abs(x)>.9||Math.abs(y)>.85; if(edge){ const m=Math.max(Math.abs(x)/.9,Math.abs(y)/.85,1e-3); x/=m; y/=m; }
  el.style.opacity=1; el.style.left=((x*.5+.5)*innerWidth)+'px'; el.style.top=((-y*.5+.5)*innerHeight)+'px'; el.classList.toggle('edge',edge);
  $('markerDist').textContent=Math.round(p.distanceTo(PLAYER.pos))+' '+MARKER.unit;
});

