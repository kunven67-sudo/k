/* ================================================================
   CHARACTERS (ANT WORK 3) — the two Jays (normal + green hoodie, and
   the blocky Mars one at the start), blocky people from Ant Work 2,
   and bodies for the chair scene. (Both of you call Jim on your WATCH, like Ant Work 2.)
   ================================================================ */
/* ---------- 16x16 pixel-art textures, drawn crisp (the blocky Jay) ---------- */
const PIX={};
function pixTex(key,draw,w=16,h=16){ if(PIX[key]) return PIX[key]; const t=canvasTex(w,h,(x)=>draw(x,w,h),null,{nearest:true}); PIX[key]=t; return t; }
function blockFaceTex(o){ return canvasTex(8,8,(x)=>{ x.fillStyle=o.skinHex; x.fillRect(0,0,8,8); x.fillStyle=o.hairHex; x.fillRect(0,0,8,2); x.fillRect(0,2,1,1); x.fillRect(7,2,1,1);
  x.fillStyle='#ffffff'; x.fillRect(1,3,2,1); x.fillRect(5,3,2,1); x.fillStyle=o.eyeHex||'#3a2a8a'; x.fillRect(2,3,1,1); x.fillRect(5,3,1,1);
  x.fillStyle=o.mouthHex||'#94584a'; x.fillRect(3,5,2,1); if(o.beard){ x.fillStyle=o.hairHex; x.fillRect(1,5,1,2); x.fillRect(6,5,1,2); x.fillRect(2,6,4,1); } },null,{nearest:true}); }
function flatTex(hex,shade=.85,n=40){ return canvasTex(8,8,(x)=>{ x.fillStyle=hex; x.fillRect(0,0,8,8); const c=new THREE.Color().setHex(parseInt(hex.slice(1),16));
 for(let i=0;i<n;i++){ const k=rand(shade,1.1); x.fillStyle=`rgb(${Math.min(255,c.r*255*k)|0},${Math.min(255,c.g*255*k)|0},${Math.min(255,c.b*255*k)|0})`; x.fillRect(Math.random()*8|0,Math.random()*8|0,1,1); } },null,{nearest:true}); }
const FOLK=[];
function makeBlockPerson(o={}){
  const opt=Object.assign({skin:0xd8a880,shirt:0x3a7ad8,pants:0x2a3a6a,hair:0x4a2e1a,shoes:0x2a2a2a,name:'?',voice:'Jim',beard:false},o);
  const hx=h=>'#'+new THREE.Color(h).getHexString();
  const g=new THREE.Group(); g.name=opt.name;
  const S=new THREE.MeshStandardMaterial({map:flatTex(hx(opt.skin),.97,6),roughness:.85});
  const F=new THREE.MeshStandardMaterial({map:blockFaceTex({skinHex:hx(opt.skin),hairHex:hx(opt.hair),beard:opt.beard}),roughness:.85});
  const Hm=new THREE.MeshStandardMaterial({map:flatTex(hx(opt.hair),.9,14),roughness:.9});
  const T=new THREE.MeshStandardMaterial({map:flatTex(hx(opt.shirt),.94,12),roughness:.9});
  const P=new THREE.MeshStandardMaterial({map:flatTex(hx(opt.pants),.94,12),roughness:.9});
  const Sh=mat(opt.shoes,{roughness:.8});
  const box_=(w,h,d,m)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); b.castShadow=true; b.receiveShadow=true; return b; };
  const hips=new THREE.Group(); hips.position.y=.72; g.add(hips);
  const torso=box_(.44,.66,.24,T); torso.position.y=.33; hips.add(torso);
  const headJ=new THREE.Group(); headJ.position.y=.66; hips.add(headJ);
  const head=box_(.44,.44,.44,[S,S,Hm,S,F,Hm]); head.position.y=.22; headJ.add(head);
  const hairBack=box_(.46,.2,.46,Hm); hairBack.position.set(0,.36,-.01); headJ.add(hairBack);
  const limb=(x,y,m,m2,len=.66)=>{ const j=new THREE.Group(); j.position.set(x,y,0); const l=box_(.2,len,.22,m); l.position.y=-len/2; j.add(l); if(m2){ const e=box_(.21,.14,.23,m2); e.position.y=-len+.07; j.add(e); } return j; };
  const armL=limb(.32,.62,T,S,.62), armR=limb(-.32,.62,T,S,.62);
  hips.add(armL); hips.add(armR);
  const legL=limb(.11,0,P,Sh,.72), legR=limb(-.11,0,P,Sh,.72); hips.add(legL); hips.add(legR);
  const holdR=new THREE.Group(); holdR.position.y=-.66; armR.add(holdR);
  g.userData={folk:true,holdR,name:opt.name,voice:opt.voice,head:headJ,parts:{hips,torso,headJ,armL,armR,legL,legR},
    A:{talk:false,mood:'neutral',moodK:{},pose:null,phase:Math.random()*10,speed:0,lastPos:new THREE.Vector3(),walkPhase:0,look:null,mode:null,path:null}};
  FOLK.push(g); return g;
}
function animateBlockPerson(p,dt,t){
  const U=p.userData, A=U.A, J=U.parts; if(!p.visible) return;
  p.getWorldPosition(_hw); const moved=_hw.distanceTo(A.lastPos); A.lastPos.copy(_hw);
  const sp=dt>0?Math.min(8,moved/dt):0; A.speed=damp(A.speed,sp>.05?sp:0,10,dt);
  const wk=Math.min(1,A.speed/1.2); A.walkPhase+=dt*A.speed*3.2;
  const s=Math.sin(A.walkPhase)*.7*wk;
  J.legL.rotation.x=s; J.legR.rotation.x=-s; J.armL.rotation.x=-s*.8; J.armR.rotation.x=s*.8; J.armL.rotation.z=.05; J.armR.rotation.z=-.05;
  J.hips.position.y=.72+Math.abs(Math.cos(A.walkPhase))*.04*wk;
  if(A.pose==='point'||A.pose==='holdOut'){ J.armR.rotation.x=-1.45; J.armR.rotation.z=-.05; }
  if(A.pose==='talk'&&A.talk){ J.armR.rotation.x=-.5+Math.sin(t*3+A.phase)*.25; J.armL.rotation.x=-.3+Math.cos(t*2.6)*.15; }
  if(A.pose==='hips'){ J.armL.rotation.z=.5; J.armR.rotation.z=-.5; }
  if(A.pose==='shrug'){ J.armL.rotation.z=.9; J.armR.rotation.z=-.9; J.armL.rotation.x=J.armR.rotation.x=-.4; }
  if(A.pose==='guard'){ J.armL.rotation.x=-1.6; J.armR.rotation.x=-1.6; J.armL.rotation.z=.25; J.armR.rotation.z=-.25; }
  if(A.mode==='wave'){ J.armR.rotation.z=-2.6+Math.sin(t*10)*.4; }
  if(A.custom) A.custom(J,t,dt);
  const talk=A.talk?Math.sin(t*14)*.06:0;
  let yaw=0; if(A.look==='player'){ const d=camera.position.clone().sub(_hw); yaw=clamp(angDiff(p.rotation.y,Math.atan2(d.x,d.z)),-.9,.9); } else if(A.look&&A.look.isVector3){ const d=A.look.clone().sub(_hw); yaw=clamp(angDiff(p.rotation.y,Math.atan2(d.x,d.z)),-.9,.9); }
  J.headJ.rotation.y=damp(J.headJ.rotation.y,yaw,6,dt); J.headJ.rotation.x=talk+Math.sin(t*1.3+A.phase)*.02;
  if(A.path){ const P=A.path; const tg=P.pts[P.i]; const dx=tg.x-p.position.x, dz=tg.z-p.position.z, d=Math.hypot(dx,dz), st=P.speed*dt;
    if(d<=st){ p.position.x=tg.x; p.position.z=tg.z; P.i++; if(P.i>=P.pts.length){ A.path=null; P.res&&P.res(); } } else { p.position.x+=dx/d*st; p.position.z+=dz/d*st; p.rotation.y=angLerp(p.rotation.y,Math.atan2(dx,dz),Math.min(1,dt*8));
      const px=p.position.x-PLAYER.pos.x, pz=p.position.z-PLAYER.pos.z, pd=Math.hypot(px,pz); if(pd<.75&&pd>1e-4){ p.position.x=PLAYER.pos.x+px/pd*.75; p.position.z=PLAYER.pos.z+pz/pd*.75; } } }
}
function folkWalk(p,pts,speed=1.6){ return new Promise(res=>{ p.userData.A.path={pts,i:0,speed,res}; }); }
function updateFolk(dt,t){ for(const p of FOLK){ if(!p.parent||!p.visible) continue; if(LV&&p.userData.level&&p.userData.level!==LV.name) continue; animateBlockPerson(p,dt,t); } }
on('tick',()=>{ updateFolk(G.dt||.016,G.time); });

/* ---------- the Jays ---------- */
const JAY_LOOK={skin:0xe2b08c,hair:0x2a1c12,eye:0x4a3020,pants:0x2e3440,shoes:0x2a2a2e,hood:true,collar:false,sleeves:'long',stubble:.14,head:{rx:.073,ry:.103,rz:.092,jaw:.3,nose:.95}};
function makeJay(o={}){ return makeHuman(Object.assign({name:'Jay',voice:'Jay',shirt:0x2f4d6e},JAY_LOOK,o)); }
/* Jay 2 after the teleport: same face, green hoodie so you can tell who's who */
function makeJay2(o={}){ return makeHuman(Object.assign({name:'Jay 2',voice:'Jay2',shirt:0x2e8b57},JAY_LOOK,o)); }
/* Jay 2 at the start: still blocky from XXX5 (the Mars Shift Jay) */
function makeBlockJay(o={}){ return makeBlockPerson(Object.assign({name:'Jay 2',voice:'Jay2',skin:0xe2b08c,shirt:0x2f4d6e,pants:0x2e3440,hair:0x2a1c12,shoes:0x2a2a2e},o)); }

/* ---------- your own arms in the world (when you sit chained, the arms stay on the chair while you look around) ---------- */
function makeWorldArm(side){
  const T=charTex();
  const sleeveM=new THREE.MeshPhysicalMaterial({color:col(0x2f4d6e),roughness:.9,map:T.cloth.map,normalMap:T.cloth.normalMap,sheen:col(0x222222)});
  const skinM=skinify(new THREE.MeshPhysicalMaterial({color:col(0xe2b08c),roughness:.5,normalMap:T.skinN.normalMap,normalScale:new THREE.Vector2(.3,.3),sheen:col(0x442a22)}));
  const g=new THREE.Group();
  const fore=mesh(lathe('vmFore2',[[0,-.2],[.05,-.198],[.056,-.182],[.054,-.1],[.052,.05],[.053,.2],[0,.25]],18),sleeveM,0,0,0); fore.rotation.x=Math.PI/2; g.add(fore);
  g.add(mesh(GC('vmCuff2',()=>new THREE.TorusGeometry(.052,.014,8,22)),sleeveM,0,0,-.188));
  const skinFore=mesh(lathe('vmSkinFore',[[0,-.318],[.03,-.314],[.0315,-.3],[.034,-.27],[.04,-.23],[.046,-.19],[0,-.18]],18),skinM,0,0,0); skinFore.rotation.x=Math.PI/2; g.add(skinFore);
  const wrist=mesh(GC('vmWrist',()=>new THREE.CylinderGeometry(.029,.031,.06,14)),skinM,0,0,-.31); wrist.rotation.x=Math.PI/2; g.add(wrist);
  const handG=new THREE.Group(); handG.position.set(0,0,-.33); handG.rotation.x=Math.PI/2; g.add(handG);
  const H=makeHand(side,skinM); handG.add(H.grp); H.grp.rotation.y=side>0?-.3:.3;
  for(const fg of H.fingers){ fg.a.rotation.x=-.25; fg.b.rotation.x=-.3; if(fg.c) fg.c.rotation.x=-.25; }
  g.userData={H,skinM,sleeveM};
  { const el=V3(0,0,.2), sh=V3(side*.24,.5,.55), d=sh.clone().sub(el), L=d.length(); const up=mesh(new THREE.CylinderGeometry(.06,.05,L,14),sleeveM,0,0,0); up.position.copy(el).addScaledVector(d,.5); up.quaternion.setFromUnitVectors(V3(0,1,0),d.normalize()); g.add(up); g.add(mesh(new THREE.SphereGeometry(.055,14,10),sleeveM,el.x,el.y,el.z)); }
  if(side>0){ const w=new THREE.Group(); w.position.set(0,0,-.281); g.add(w);
    const strapM=new THREE.MeshStandardMaterial({color:col(0x16181c),roughness:.62,side:THREE.DoubleSide});
    const strap=mesh(GC('wStrap',()=>new THREE.CylinderGeometry(.0338,.0338,.019,32,1,true)),strapM,0,0,0); strap.rotation.x=Math.PI/2; w.add(strap);
    w.add(mesh(roundedBoxGeo(.041,.011,.047,.006),mat(0x2a2e36,{roughness:.25,metalness:.85}),0,.0375,0));
    const scr=mesh(GC('wScrW2',()=>new THREE.PlaneGeometry(.033,.039)),new THREE.MeshBasicMaterial({color:col(0x0a1214)}),0,.0436,0,false); scr.rotation.order='YXZ'; scr.rotation.set(-Math.PI/2,Math.PI/2,0); w.add(scr);
    g.userData.watch=w;
    const st=new THREE.Group(); st.position.set(0,0,-.322); g.add(st); st.add(mesh(GC('vmScar',()=>new THREE.TorusGeometry(.0312,.0055,6,28)),mat(0xb0403c,{roughness:.55}),0,0,0)); }
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return g;
}
/* an iron shackle round a wrist, with a short chain down to a ring (world space) */
function makeShackle(chainLen=.35,ironM){
  ironM=ironM||pbrMat('rusty_metal_04',.3,{opts:{metalness:.85,roughness:.75}});
  const g=new THREE.Group();
  const band=mesh(GC('shkBand',()=>new THREE.TorusGeometry(.05,.016,8,22)),ironM,0,0,0); g.add(band);
  g.add(mesh(GC('shkHinge',()=>new THREE.CylinderGeometry(.012,.012,.05,8)),ironM,.05,0,0));
  const links=new THREE.Group(); g.add(links);
  const n=Math.max(2,Math.round(chainLen/.045));
  for(let i=0;i<n;i++){ const l=mesh(GC('shkLink',()=>new THREE.TorusGeometry(.018,.006,6,12)),ironM,0,-.065-i*.04,0); l.rotation.y=i%2?Math.PI/2:0; l.rotation.x=Math.PI/2*0; links.add(l); }
  g.userData={band,links,n};
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return g;
}
/* a bloody nose (after the fight). Works on people and on the blocky Jay */
function addNoseBlood(h){
  if(h.userData.nose) return h.userData.nose;
  const bm=new THREE.MeshStandardMaterial({color:col(0x6e0b0b),roughness:.25,metalness:0,emissive:col(0x1a0000)});
  const g=new THREE.Group();
  if(h.userData.folk){ const s1=new THREE.Mesh(new THREE.BoxGeometry(.03,.07,.01),bm); s1.position.set(.04,-.07,.225); g.add(s1); const s2=new THREE.Mesh(new THREE.BoxGeometry(.025,.05,.01),bm); s2.position.set(-.03,-.05,.225); g.add(s2); g.position.y=.22; h.userData.parts.headJ.add(g); }
  else { const head=h.userData.J&&h.userData.J.head; if(!head) return null;
    for(const [x,len] of [[.012,.05],[-.012,.034]]){ const s=new THREE.Mesh(new THREE.CylinderGeometry(.0045,.006,len,6),bm); s.position.set(x,-len/2,.097); s.rotation.x=-.18; g.add(s); }
    const lip=new THREE.Mesh(new THREE.SphereGeometry(.007,8,6),bm); lip.position.set(.01,-.04,.099); lip.scale.set(1.4,.6,.6); g.add(lip);
    head.add(g); g.position.y=.1; }
  h.userData.nose=g; g.visible=true; return g;
}
