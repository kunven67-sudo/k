/* ================================================================
   THE PIG-MAN — fat, armored, sits like a person on his throne and
   eats a big roasted leg (bone and all) with his hands. Only oinks
   and grunts. Origin = the middle of the seat on the floor, facing +z.
   ================================================================ */
function meatTex(){
  return canvasTex(256,256,(x,w,h)=>{
    const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#5a2a12'); g.addColorStop(.5,'#7a3a16'); g.addColorStop(1,'#4a200c'); x.fillStyle=g; x.fillRect(0,0,w,h);
    for(let i=0;i<900;i++){ const c=Math.random(); x.fillStyle=c<.35?'rgba(40,14,4,.5)':c<.7?'rgba(150,80,30,.35)':'rgba(210,150,80,.25)'; const s=rand(1,6); x.fillRect(rand(0,w),rand(0,h),s,s*rand(.5,2)); }
    x.strokeStyle='rgba(25,8,2,.55)'; x.lineWidth=7; for(let i=0;i<5;i++){ x.beginPath(); const y=i*52+20; x.moveTo(0,y); x.bezierCurveTo(80,y+20,170,y-15,256,y+8); x.stroke(); }   // grill marks
    x.fillStyle='rgba(235,200,140,.35)'; for(let i=0;i<14;i++){ x.beginPath(); x.ellipse(rand(0,w),rand(0,h),rand(4,14),rand(2,6),rand(0,3),0,7); x.fill(); }  // fat
  },[1,1]);
}
function makeMeatLeg(){
  const g=new THREE.Group();
  const meatM=new THREE.MeshPhysicalMaterial({map:meatTex(),color:col(0xffffff),roughness:.45,clearcoat:.5,clearcoatRoughness:.35,sheen:col(0x552200)});
  const boneM=mat(0xe8dcc0,{roughness:.6});
  // meat bulb along +y, bone sticking out the bottom
  const meat=mesh(lathe('meatLeg',[[0,0],[.045,.01],[.07,.05],[.1,.13],[.115,.21],[.112,.27],[.095,.32],[.06,.355],[0,.37]],20),meatM,0,0,0); g.add(meat);
  const bone=mesh(GC('meatBone',()=>new THREE.CylinderGeometry(.022,.026,.16,10)),boneM,0,-.06,0); g.add(bone);
  for(const sx of [-.016,.016]) g.add(sph(.028,boneM,sx,-.145,0,10,8));
  // a bitten edge: a paler torn bit near the top
  const bit=mesh(GC('meatBite',()=>new THREE.SphereGeometry(.05,10,8)),mat(0xc07a50,{roughness:.8}),.07,.27,.05); bit.scale.set(1,.7,.5); g.add(bit);
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  g.userData={meat,bit,left:1};
  return g;
}
/* every bite takes a chunk off the top of the leg (down to a stub) */
function pigBiteMeat(P){ const U=P.meat.userData; if(!U||!U.meat) return; U.left=Math.max(.42,U.left-.075); const w=lerp(.86,1,(U.left-.42)/.58); U.meat.scale.set(w,U.left,w); U.bit.position.y=.37*U.left-.07; U.bit.scale.set(1.25,.55,.9); U.bit.position.x=.03; }
function makePigMan(){
  const T=charTex();
  const root=new THREE.Group(); root.name='Pig';
  const skin=skinify(new THREE.MeshPhysicalMaterial({color:col(0xc98f86),roughness:.62,normalMap:T.skinN.normalMap,normalScale:new THREE.Vector2(.5,.5),sheen:col(0x553030)}),[1,.55,.5]);
  const snoutM=skinify(new THREE.MeshPhysicalMaterial({color:col(0xb8706a),roughness:.38,normalMap:T.skinN.normalMap,normalScale:new THREE.Vector2(.8,.8)}),[1,.5,.5]);
  const dark=new THREE.MeshStandardMaterial({color:col(0x1a0c0a),roughness:.6});
  const eyeM=new THREE.MeshPhysicalMaterial({color:col(0x120806),roughness:.08,clearcoat:1});
  const tuskM=mat(0xe6dcc4,{roughness:.45});
  const iron=pbrMat('rusty_metal_04',.6,{opts:{metalness:.9,roughness:.5}}); iron.color=col(0xc0b0a0);
  const leather=pbrMat('brown_leather',.5,{opts:{roughness:.75}}); leather.color=col(0x8a6a50);
  const cloth=new THREE.MeshPhysicalMaterial({color:col(0x7a5a40),roughness:.95,map:T.cloth.map,normalMap:T.cloth.normalMap,sheen:col(0x221510)});
  const gold=new THREE.MeshStandardMaterial({color:col(0xb8862e),metalness:1,roughness:.35});
  const add=(p,m)=>{ p.add(m); m.castShadow=true; m.receiveShadow=true; return m; };
  // ---- body ----
  const hips=new THREE.Group(); hips.position.set(0,.72,0); root.add(hips);
  const pelvis=add(hips,mesh(new THREE.SphereGeometry(.42,24,16),cloth,0,.06,.02)); pelvis.scale.set(1.05,.6,.95);
  const spine=new THREE.Group(); spine.position.set(0,.12,0); hips.add(spine);
  const belly=add(spine,mesh(new THREE.SphereGeometry(.5,32,24),cloth,0,.26,.16)); belly.scale.set(1.08,.92,1.0);
  const chest=new THREE.Group(); chest.position.set(0,.55,-.02); spine.add(chest);
  const torso=add(chest,mesh(lathe('pigTorso',[[0,-.12],[.4,-.1],[.44,.08],[.42,.28],[.34,.42],[.2,.5],[0,.52]],24,.82),skin,0,0,0));
  // armor: breastplate, pauldrons, belt
  const plate=add(chest,mesh(lathe('pigPlate',[[.36,-.02],[.45,.06],[.465,.2],[.44,.32],[.36,.42],[.22,.47]],24,.86),iron,0,0,.005)); plate.material.side=THREE.DoubleSide;
  for(const sd of [-1,1]){ const pa=add(chest,mesh(new THREE.SphereGeometry(.2,18,12,0,Math.PI*2,0,Math.PI/2),iron,sd*.42,.38,0)); pa.scale.set(1.15,.75,1.1); pa.rotation.z=sd*-.35;
    for(let i=0;i<3;i++) add(chest,sph(.018,gold,sd*(.36+i*.06),.48-i*.035,.16,8,6)); }
  const belt=add(spine,mesh(new THREE.TorusGeometry(.5,.05,10,32),leather,0,.02,.14)); belt.rotation.x=Math.PI/2; belt.scale.set(1.08,.98,1);
  add(spine,mesh(roundedBoxGeo(.16,.12,.05,.015),gold,0,.02,.66));
  for(const sd of [-1,1]){ const strap=add(chest,mesh(new THREE.BoxGeometry(.07,.62,.03),leather,sd*.2,.12,.37)); strap.rotation.z=sd*.25; strap.rotation.x=-.25; }
  // ---- head: a big boar-like pig head, long snout, small mean eyes, tusks ----
  const neck=new THREE.Group(); neck.position.set(0,.47,.04); chest.add(neck);
  add(neck,mesh(new THREE.CylinderGeometry(.24,.31,.24,20),skin,0,.05,0));
  const head=new THREE.Group(); head.position.set(0,.25,.06); neck.add(head);
  const skull=add(head,mesh(new THREE.SphereGeometry(.21,30,22),skin,0,.05,-.06)); skull.scale.set(.92,.86,1.28);
  // fat cheeks + jowls hanging down
  for(const sd of [-1,1]){ const ch=add(head,mesh(new THREE.SphereGeometry(.12,18,14),skin,sd*.12,-.05,.06)); ch.scale.set(.95,1.0,1.15);
    const jw=add(head,mesh(new THREE.SphereGeometry(.1,16,12),skin,sd*.1,-.14,.0)); jw.scale.set(1,.8,1.1); }
  // the long snout, tapering forward and a little down
  const muz=new THREE.Group(); muz.position.set(0,-.02,.1); muz.rotation.x=.38; head.add(muz);
  const mzl=add(muz,mesh(new THREE.CylinderGeometry(.074,.14,.34,24,1,true),skin,0,0,.15)); mzl.rotation.x=Math.PI/2; mzl.scale.set(1,1,.86);
  const disc=add(muz,mesh(new THREE.CylinderGeometry(.078,.074,.03,24),snoutM,0,0,.32)); disc.rotation.x=Math.PI/2; disc.scale.set(1,1,.82);
  for(const sd of [-1,1]){ const n=add(muz,mesh(new THREE.SphereGeometry(.016,10,8),dark,sd*.029,-.006,.336)); n.scale.set(.75,1.25,.35); }
  // wrinkles across the top of the snout
  for(let i=0;i<3;i++){ const w=add(muz,mesh(new THREE.TorusGeometry(.105-i*.012,.005,6,18,Math.PI*.7),skin,0,.0,.07+i*.05)); w.rotation.z=Math.PI*.15; w.scale.set(1,.9,1); }
  // eyes: small, deep, under a heavy angry brow
  const eyes=[];
  for(const sd of [-1,1]){ const sock=add(head,mesh(new THREE.SphereGeometry(.03,12,10),new THREE.MeshStandardMaterial({color:col(0x3a1a18),roughness:.9}),sd*.13,.07,.1)); sock.scale.set(.8,.7,.6);
    const e=add(head,mesh(new THREE.SphereGeometry(.016,12,10),eyeM,sd*.135,.068,.112)); eyes.push(e);
    const glint=add(head,mesh(new THREE.SphereGeometry(.004,6,6),new THREE.MeshBasicMaterial({color:0xffd8b0}),sd*.134,.073,.126));
    const brow=add(head,mesh(new THREE.CylinderGeometry(.026,.02,.1,10),skin,sd*.12,.1,.11)); brow.rotation.z=Math.PI/2+sd*.45; brow.rotation.y=sd*.5; }
  // big ears, pointing out and drooping forward
  const ears=[];
  for(const sd of [-1,1]){ const ep=new THREE.Group(); ep.position.set(sd*.16,.16,-.02); head.add(ep);
    const ear=add(ep,mesh(new THREE.ConeGeometry(.12,.3,16,1,true),skin,0,.13,0)); ear.scale.set(1,1,.28); ear.material=skin;
    ep.rotation.set(1.35,0,sd*-.75); ears.push(ep); }
  // lower jaw (chews) with big curved tusks
  const jaw=new THREE.Group(); jaw.position.set(0,-.13,.12); head.add(jaw);
  const jm=add(jaw,mesh(new THREE.SphereGeometry(.13,18,12),skin,0,-.01,.1)); jm.scale.set(.85,.38,1.2);
  add(jaw,mesh(new THREE.BoxGeometry(.13,.012,.05),mat(0x2a0808,{roughness:.6}),0,.025,.21));
  for(const sd of [-1,1]){ const tk=new THREE.Group(); tk.position.set(sd*.075,.02,.2); jaw.add(tk);
    for(let i=0;i<4;i++){ const seg=add(tk,mesh(new THREE.CylinderGeometry(.013-i*.003,.016-i*.003,.035,8),tuskM,sd*i*.008,.03*i,-.004*i*i)); seg.rotation.z=-sd*(.25+i*.18); seg.rotation.x=-.2-i*.12; } }
  // a crude crown (the pig king from the paintings)
  const crown=new THREE.Group(); crown.position.set(0,.2,-.01); head.add(crown);
  add(crown,mesh(new THREE.CylinderGeometry(.17,.19,.07,20,1,true),gold,0,0,0)).material.side=THREE.DoubleSide;
  for(let i=0;i<7;i++){ const a=i/7*Math.PI*2; add(crown,mesh(new THREE.ConeGeometry(.025,.09,6),gold,Math.sin(a)*.18,.07,Math.cos(a)*.18)); }
  crown.rotation.x=-.12; crown.rotation.z=.08;
  // ---- arms ----
  const arm=(sd)=>{ const sh=new THREE.Group(); sh.position.set(sd*.47,.32,.0); chest.add(sh);
    add(sh,mesh(lathe('pigUpper',[[0,0],[.14,-.03],[.15,-.15],[.13,-.3],[.11,-.38],[0,-.4]],16),skin,0,0,0));
    const el=new THREE.Group(); el.position.set(0,-.36,0); sh.add(el);
    add(el,mesh(lathe('pigFore',[[0,0],[.115,-.02],[.11,-.15],[.09,-.3],[0,-.33]],16),skin,0,0,0));
    add(el,mesh(new THREE.TorusGeometry(.1,.025,8,18),iron,0,-.25,0)).rotation.x=Math.PI/2;   // iron bracer
    const hand=new THREE.Group(); hand.position.set(0,-.33,0); el.add(hand);
    const palm=add(hand,sph(.075,skin,0,-.05,0,14,10)); palm.scale.multiply(V3(1,1.15,.7));
    const fingers=[]; for(let i=0;i<4;i++){ const f=new THREE.Group(); f.position.set((i-1.5)*.034,-.12,.02); hand.add(f); add(f,mesh(GC('pigFing',()=>{ const c=new THREE.CylinderGeometry(.019,.017,.08,8); c.translate(0,-.04,0); return c; }),skin,0,0,0)); fingers.push(f); }
    const th=new THREE.Group(); th.position.set(-sd*.06,-.06,.04); hand.add(th); add(th,mesh(GC('pigThumb',()=>{ const c=new THREE.CylinderGeometry(.02,.018,.07,8); c.translate(0,-.035,0); return c; }),skin,0,0,0)); th.rotation.z=-sd*.7;
    return {sh,el,hand,fingers,th}; };
  const R=arm(-1), L=arm(1);   // facing +z: his right hand is on -x
  // ---- legs: jointed (hip -> knee -> ankle) so he can sit, stand up, walk (Part 2) ----
  const legs=[];
  for(const sd of [-1,1]){ const hipJ=new THREE.Group(); hipJ.position.set(sd*.23,.02,.05); hips.add(hipJ);
    const th=add(hipJ,mesh(new THREE.CylinderGeometry(.17,.15,.55,14),cloth,0,-.275,0));
    const knee=new THREE.Group(); knee.position.set(0,-.55,0); hipJ.add(knee);
    add(knee,mesh(new THREE.CylinderGeometry(.13,.11,.62,14),cloth,0,-.31,0));
    const ankle=new THREE.Group(); ankle.position.set(0,-.62,0); knee.add(ankle);
    add(ankle,mesh(roundedBoxGeo(.2,.16,.3,.05),iron,0,-.04,.07));
    legs.push({sd,hipJ,knee,ankle}); }
  // the meat, in his right hand
  const meat=makeMeatLeg(); meat.position.set(0,-.13,.05); meat.rotation.set(1.9,0,0); R.hand.add(meat);
  const P={root,hips,spine,chest,belly,neck,head,jaw,ears,eyes,R,L,meat,legs,stand:0,walkPh:0,walkK:0,sleep:0,armPose:null,
    eatT:0,phase:'chew',look:null,lookW:0,yaw:0,pitch:0,grunted:0,stop:false,biteN:0,
    onBite:null,onGrunt:null};
  root.userData.pig=P;
  root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return root;
}
/* search (once) for the shoulder/elbow angles that put the top of the leg right at his mouth */
function pigFindReach(root,P){
  const M=P.meat; if(!M) return {sx:0,sy:0,sz:0,ex:0};
  const sh=P.R.sh.rotation.clone(), el=P.R.el.rotation.clone(), hd=P.R.hand.rotation.clone(), tip=new THREE.Vector3(), mouth=new THREE.Vector3();
  P.R.hand.rotation.set(.35,.6,0); let best={sx:0,sy:0,sz:0,ex:0}, bd=1e9;
  for(let sx=-.6;sx<=.61;sx+=.2) for(let sy=-1;sy<=1.01;sy+=.2) for(let sz=-.8;sz<=.81;sz+=.2) for(let ex=-.6;ex<=.61;ex+=.3){
    P.R.sh.rotation.set(-1.25+sx,-.25+sy,.38+sz); P.R.el.rotation.set(-2.05+ex,0,-.3); root.updateMatrixWorld(true);
    M.localToWorld(tip.set(0,.34,0)); P.head.localToWorld(mouth.set(0,-.1,.3)); const d=tip.distanceTo(mouth);
    if(d<bd){ bd=d; best={sx,sy,sz,ex}; } }
  P.R.sh.rotation.copy(sh); P.R.el.rotation.copy(el); P.R.hand.rotation.copy(hd); root.updateMatrixWorld(true);
  return best;
}
/* the eating loop: lift the leg, bite, tear, chew, grunt. P.stop = sit still and stare */
const _pgv=new THREE.Vector3(), _pgw=new THREE.Vector3(), _pgT=new THREE.Vector3(), _pgM=new THREE.Vector3();
function animatePigMan(root,dt,t){
  const P=root.userData.pig;
  // breathing: the belly heaves
  const br=Math.sin(t*1.3);
  P.belly.scale.set(1.08+br*.015,.92+br*.012,1+br*.02); P.chest.position.y=.55+br*.006;
  let raise=0, jawOpen=0, headF=0;
  if(!P.stop){
    P.eatT+=dt; const cyc=6.2, k=P.eatT%cyc;
    if(k<1.1){ raise=smooth(k/1.1); }                                   // lift the leg to the mouth
    else if(k<1.5){ raise=1; jawOpen=Math.sin(clamp((k-1.1)/.4,0,1)*Math.PI)*.9; headF=jawOpen*.35; }   // open wide... chomp
    else if(k<1.9){ raise=1-smooth((k-1.5)/.4)*.35; headF=-.15*Math.sin((k-1.5)/.4*Math.PI); }        // tear it off
    else if(k<2.6){ raise=.65-smooth((k-1.9)/.7)*.65; }
    if(k>=1.5&&P.lastK<1.5&&P.onBite) P.onBite(P);
    if(k>=1.6&&k<5.2) jawOpen=Math.max(jawOpen,(Math.sin((k-1.6)*11)*.5+.5)*.35);                 // chew chew chew
    if(k>=3.3&&P.lastK<3.3&&P.onChew) P.onChew(P);
    if(k>=4.6&&P.lastK<4.6&&P.onGrunt) P.onGrunt(P);
    P.lastK=k;
  }
  P.raise=damp(P.raise||0,raise,10,dt); const r=P.raise;
  // right arm: resting on the armrest -> hand at the mouth
  if(P.reach===undefined) P.reach=pigFindReach(root,P);   // once: the arm angles that bring the leg to his mouth
  const F=P.reach;
  P.R.sh.rotation.set(lerp(-.35,-1.25+F.sx,r),lerp(.1,-.25+F.sy,r),lerp(.12,.38+F.sz,r));
  P.R.el.rotation.set(lerp(-1.2,-2.05+F.ex,r),0,lerp(0,-.3,r));
  P.R.hand.rotation.set(lerp(-.1,.35,r),lerp(0,.6,r),0);
  for(const f of P.R.fingers) f.rotation.x=-1.25; P.R.th.rotation.x=-.6;
  // left arm: on the armrest, fingers drumming
  P.L.sh.rotation.set(-.35,-.05,-.15); P.L.el.rotation.set(-1.2,0,0); P.L.hand.rotation.set(.1,0,0);
  P.L.fingers.forEach((f,i)=>{ f.rotation.x=-.4-Math.max(0,Math.sin(t*6-i*.7))*.4; });
  P.jaw.rotation.x=damp(P.jaw.rotation.x,jawOpen*.45,18,dt);
  // head: leans into the bite, otherwise looks at whatever P.look is
  let yaw=Math.sin(t*.4)*.12, pitch=headF+Math.sin(t*.9)*.03;
  if(P.look){ root.updateMatrixWorld(); P.neck.getWorldPosition(_pgw); const tgt=P.look.isVector3?P.look:P.look.getWorldPosition(_pgv);
    const loc=root.worldToLocal(tgt.clone()); const nl=root.worldToLocal(_pgw.clone()); const dx=loc.x-nl.x, dy=loc.y-nl.y-.26, dz=loc.z-nl.z;
    const ly=Math.atan2(dx,dz), lp=-Math.atan2(dy,Math.hypot(dx,dz));
    P.lookW=damp(P.lookW,1,P.lookSpeed||2,dt); yaw=lerp(yaw,clamp(ly,-1.1,1.1),P.lookW); pitch=lerp(pitch,clamp(lp,-.5,.5),P.lookW); }
  P.yaw=damp(P.yaw,yaw,P.look?3:6,dt); P.pitch=damp(P.pitch,pitch,8,dt);
  P.neck.rotation.set(P.pitch*.4,P.yaw*.45,0); P.head.rotation.set(P.pitch*.6,P.yaw*.55,0);
  // ears flick now and then
  P.earT=(P.earT||0)-dt; if(P.earT<=0){ P.earT=rand(2,6); P.earK=1; } P.earK=Math.max(0,(P.earK||0)-dt*5);
  P.ears.forEach((e,i)=>{ e.rotation.x=1.35-Math.sin(P.earK*Math.PI)*.35*(i?1:.6); });
  // the leg really goes INTO his mouth when he bites (the arm alone stopped beside his face)
  { const M=P.meat; if(M){ if(!M.userData.home) M.userData.home=M.position.clone(); M.position.copy(M.userData.home);
    if(P.raise>.02){ root.updateMatrixWorld(true);
      const tip=M.localToWorld(_pgT.set(0,.37*(M.userData.left||1)-.03,0)), mouth=P.head.localToWorld(_pgM.set(0,-.1,.3));
      const hand=M.parent, a=hand.worldToLocal(tip.clone()), b=hand.worldToLocal(mouth.clone());
      M.position.addScaledVector(b.sub(a),smooth(Math.min(1,P.raise))); } } }
  pigBody(root,P,dt,t);
}
/* Part 2: legs (sit <-> stand, walk cycle), sleeping slump, and arm poses that win over the eating arms */
function pigBody(root,P,dt,t){
  const st=smooth(P.stand), wk=P.walkK*st, ph=P.walkPh;
  P.hips.position.y=lerp(.72,1.3,st)+Math.abs(Math.sin(ph))*.04*wk;
  P.hips.rotation.z=Math.sin(ph)*.06*wk; P.spine.rotation.x=lerp(0,.06,st)+.04*wk;
  for(const L of P.legs){ const s=L.sd<0?0:Math.PI, sw=Math.sin(ph+s);
    L.hipJ.rotation.x=lerp(-Math.PI/2,0,st)-sw*.42*wk;
    L.knee.rotation.x=lerp(Math.PI/2,0,st)+Math.max(0,Math.cos(ph+s))*.7*wk;
    L.ankle.rotation.x=lerp(0,0,st)-Math.max(0,-sw)*.2*wk; }
  // asleep: head drops onto the chest, mouth a little open, snoring breath
  if(P.sleep>0){ const k=smooth(P.sleep); P.neck.rotation.x=lerp(P.neck.rotation.x,.55,k); P.head.rotation.x=lerp(P.head.rotation.x,.35,k); P.head.rotation.y*=1-k;
    P.jaw.rotation.x=lerp(P.jaw.rotation.x,.12+Math.max(0,Math.sin(t*.9))*.08,k);
    P.belly.scale.multiplyScalar(1+Math.sin(t*.9)*.02*k);
    for(const e of P.eyes) e.scale.y=lerp(1,.15,k); }
  else for(const e of P.eyes) e.scale.y=1;
  if(P.armPose) try{ P.armPose(P,dt,t); }catch(e){ console.error(e); }
}
/* walk him (root on the floor) to a point; he turns first, then steps */
function pigWalkTo(root,to,speed=.9){ const P=root.userData.pig; P.walkTarget={to:to.clone(),speed}; return new Promise(r=>{ P.walkTarget.res=r; }); }
function pigWalkTick(root,dt){ const P=root.userData.pig, W=P.walkTarget; if(!W){ P.walkK=damp(P.walkK,0,6,dt); return; }
  const d=V3(W.to.x-root.position.x,0,W.to.z-root.position.z), L=d.length();
  const want=Math.atan2(d.x,d.z); root.rotation.y+=angDiff(root.rotation.y,want)*Math.min(1,dt*3);
  if(L<.05){ P.walkTarget=null; W.res&&W.res(); return; }
  const turned=Math.abs(angDiff(root.rotation.y,want))<.5; P.walkK=damp(P.walkK,turned?1:.3,5,dt);
  const v=Math.min(L,W.speed*dt*P.walkK); root.position.addScaledVector(d.normalize(),v);
  P.walkPh+=dt*W.speed*5.2*P.walkK;
  if(Math.floor(P.walkPh/Math.PI)!==P.lastStep){ P.lastStep=Math.floor(P.walkPh/Math.PI); if(P.onStep) P.onStep(); } }
