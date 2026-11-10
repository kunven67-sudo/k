/* ================================================================
   THE PIG ROOM — a stone hall lit by torches. You wake up chained to
   a chair, Jay 2 chained next to you, and on the throne in front of
   you a fat pig-man in armor is eating a leg of meat.
   ================================================================ */
AMB_DEFS.fire={freq:420,ftype:'lowpass',q:.6,vol:.05,lfo:120,lfoRate:1.3};
const PIGROOM={you:V3(.8,0,2.2),jay2:V3(-.8,0,2.2),throne:V3(0,0,-2.4),eye:1.18};
function makeTorch(scene,lv,x,y,z,ry,big){
  const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry; scene.add(g);
  const iron=pbrMat('rusty_metal_04',.3,{opts:{metalness:.85,roughness:.7}});
  if(!big){ g.add(box(.08,.22,.08,iron,0,-.2,.1)); const arm=box(.04,.04,.3,iron,0,-.1,.0); g.add(arm); const cup=mesh(new THREE.CylinderGeometry(.09,.05,.16,10,1,true),iron,0,0,.16); cup.material.side=THREE.DoubleSide; g.add(cup);
    const stick=cyl(.03,.035,.4,pbrMat('rough_wood',.3),0,-.05,.16,8); g.add(stick); }
  else { const bowl=mesh(new THREE.SphereGeometry(.42,18,10,0,Math.PI*2,Math.PI/2,Math.PI/2),iron,0,.95,0); bowl.material.side=THREE.DoubleSide; g.add(bowl);
    for(let i=0;i<3;i++){ const a=i/3*Math.PI*2; const l=cyl(.03,.035,1,iron,Math.cos(a)*.3,.48,Math.sin(a)*.3,8); l.rotation.z=Math.cos(a)*.25; l.rotation.x=-Math.sin(a)*.25; g.add(l); }
    const coals=mesh(new THREE.SphereGeometry(.38,16,6,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({color:col(0xff5a10).multiplyScalar(2.2)}),0,.86,0,false); coals.scale.y=.2; g.add(coals); }
  const fireAt=big?V3(0,1.05,0):V3(0,.12,.16);
  const light=new THREE.PointLight(col(0xff9a50),big?2.2:1.1,big?14:10,1.7); light.position.copy(fireAt); g.add(light);
  if(big&&SETTINGS.shadow>=2){ light.castShadow=true; light.shadow.mapSize.set(512,512); light.shadow.bias=-.004; light.shadow.camera.near=.2; light.shadow.camera.far=16; }
  const t={g,light,fireAt,big,base:big?2.2:1.1,ph:Math.random()*10};
  (lv.fires||(lv.fires=[])).push(t); return t;
}
defineLevel('pigroom',{
  title:'???',
  env:{fx:{exposure:1.12,saturation:1.05,contrast:1.12,temp:.12,bloomStrength:.4,bloomThreshold:1.1,aoRadius:.6,vignette:.55,grain:.05},music:null,reverb:.45,surface:'stone',far:120},
  async build(scene,lv){
    scene.background=col(0x050302); scene.fog=new THREE.FogExp2(col(0x0b0604),.035);
    scene.add(new THREE.HemisphereLight(col(0x5a5560),col(0x140c08),.14));
    const W=12, D=15, H=6.5, zc=-1.5;
    const brick=(w,h)=>{ const m=pbrMat('castle_brick_07',2.4,{w,h,opts:{roughness:1},normal:1.3}); m.color=col(0x8c847a); return m; };
    const fl=texPlane(W,D,'stone_tiles_02',1.6,0,0,zc,{opts:{roughness:.85}}); fl.receiveShadow=true; scene.add(fl);
    for(const [x,z,ry,w] of [[-W/2,zc,Math.PI/2,D],[W/2,zc,-Math.PI/2,D],[0,zc-D/2,0,W],[0,zc+D/2,Math.PI,W]]){ const p=mesh(withAO(new THREE.PlaneGeometry(w,H)),brick(w,H),x,H/2,z,false); p.rotation.y=ry; p.receiveShadow=true; scene.add(p); }
    const ceil=mesh(withAO(new THREE.PlaneGeometry(W,D)),brick(W,D),0,H,zc,false); ceil.rotation.x=Math.PI/2; scene.add(ceil);
    const wood=pbrMat('rough_wood',1.2,{opts:{roughness:.9}}); wood.color=col(0x8a6a4a);
    for(let i=0;i<5;i++){ const b=box(W,.32,.36,wood,0,H-.2,zc-D/2+1.5+i*3); scene.add(b); }
    // the throne: big, wooden, iron studs, leather cushion
    const T=PIGROOM.throne, th=new THREE.Group(); th.position.copy(T); scene.add(th); lv.throne=th;
    const dark=pbrMat('rough_wood',.8,{opts:{roughness:.85}}); dark.color=col(0x5a3a22);
    const iron=pbrMat('rusty_metal_04',.5,{opts:{metalness:.85,roughness:.7}});
    const leath=pbrMat('brown_leather',.6,{opts:{roughness:.7}}); leath.color=col(0x7a2a1a);
    th.add(box(1.5,.6,1.15,dark,0,.3,.05)); th.add(box(1.36,.14,1.0,leath,0,.66,.08));
    th.add(box(1.6,2.6,.22,dark,0,1.3,-.55)); th.add(box(1.36,1.3,.08,leath,0,1.35,-.42));
    for(const sd of [-1,1]){ th.add(box(.2,.45,1.1,dark,sd*.8,.82,.05)); th.add(box(.26,.08,1.18,dark,sd*.8,1.06,.06)); th.add(cyl(.11,.13,2.9,dark,sd*.82,1.45,-.55,10));
      const knob=sph(.17,iron,sd*.82,2.98,-.55,12,10); th.add(knob); }
    for(let i=0;i<9;i++) th.add(sph(.03,iron,-.7+i*.175,2.5,-.43,8,6));
    // the banner behind him: an old pig crest
    const banT=canvasTex(256,512,(c,w,h)=>{ c.fillStyle='#5a1410'; c.fillRect(0,0,w,h); c.fillStyle='rgba(0,0,0,.25)'; for(let i=0;i<40;i++) c.fillRect(0,i*13,w,2);
      c.fillStyle='#c49a3a'; c.fillRect(14,14,w-28,8); c.fillRect(14,h-60,w-28,8); c.translate(w/2,h*.42);
      c.beginPath(); c.ellipse(0,0,70,62,0,0,7); c.fill(); c.fillStyle='#5a1410'; c.beginPath(); c.ellipse(0,18,30,22,0,0,7); c.fill(); c.fillStyle='#c49a3a'; c.beginPath(); c.ellipse(-11,18,6,9,0,0,7); c.ellipse(11,18,6,9,0,0,7); c.fill();
      c.beginPath(); c.moveTo(-58,-30); c.lineTo(-80,-80); c.lineTo(-30,-52); c.fill(); c.beginPath(); c.moveTo(58,-30); c.lineTo(80,-80); c.lineTo(30,-52); c.fill();
      c.fillStyle='#5a1410'; c.beginPath(); c.arc(-26,-14,7,0,7); c.arc(26,-14,7,0,7); c.fill(); });
    const ban=mesh(new THREE.PlaneGeometry(1.7,3.4,1,8),new THREE.MeshStandardMaterial({map:banT,roughness:.95,side:THREE.DoubleSide}),0,3.6,zc-D/2+.12,false); scene.add(ban); lv.banner=ban;
    // a side table with the rest of his food
    const tb=new THREE.Group(); tb.position.set(-2.2,0,-2.2); tb.rotation.y=.35; scene.add(tb);
    tb.add(box(1.4,.08,.8,wood,0,.86,0)); for(const [x,z] of [[-.6,-.32],[.6,-.32],[-.6,.32],[.6,.32]]) tb.add(cyl(.05,.05,.84,wood,x,.42,z,8));
    const plat=mesh(new THREE.CylinderGeometry(.34,.3,.04,24),iron,0,.92,0); tb.add(plat);
    for(let i=0;i<3;i++){ const m=makeMeatLeg(); m.scale.setScalar(.8); m.position.set(-.15+i*.15,.98,rand(-.1,.1)); m.rotation.set(Math.PI/2,rand(0,3),rand(-.3,.3)); tb.add(m); }
    const jug=cyl(.09,.12,.3,pbrMat('clay_plaster',.3),.48,1.05,.15,14); tb.add(jug);
    // bones and scraps on the floor round the throne
    for(let i=0;i<10;i++){ const b=makeLongBone(rand(.18,.36)); const a=rand(0,6.28), r=rand(.9,2.6); b.rotation.set(Math.PI/2,0,rand(0,6)); b.position.set(T.x+Math.cos(a)*r,.03,T.z+1+Math.sin(a)*r*.6); scene.add(b); }
    // chains hanging on the walls
    for(const [x,z] of [[-5.9,-2],[5.9,-1],[-5.9,1.5],[5.9,2.5]]){ const s=makeShackle(1.2); s.position.set(x+(x<0?.08:-.08),2.6,z); scene.add(s); }
    // the back door
    const door=new THREE.Group(); door.position.set(0,0,zc-D/2+.05); scene.add(door); door.visible=false;
    // the gate behind you
    for(let i=0;i<9;i++){ const bar=cyl(.03,.03,3.2,iron,-1.6+i*.4,1.6,zc+D/2-.2,8); scene.add(bar); }
    scene.add(box(3.6,.12,.1,iron,0,3.1,zc+D/2-.2)); scene.add(box(3.6,.12,.1,iron,0,.4,zc+D/2-.2));
    // torches + the big fire bowl next to him
    makeTorch(scene,lv,-5.9,2.4,-4.5,Math.PI/2,false); makeTorch(scene,lv,5.9,2.4,-4.5,-Math.PI/2,false);
    makeTorch(scene,lv,-5.9,2.4,1.5,Math.PI/2,false); makeTorch(scene,lv,5.9,2.4,1.5,-Math.PI/2,false);
    lv.brazier=makeTorch(scene,lv,2.1,0,-1.6,0,true);
    // the two chairs: yours and Jay 2's
    const chairM=pbrMat('rough_wood',.7,{opts:{roughness:.9}}); chairM.color=col(0x6a4a30);
    const makeChair=(p)=>{ const c=new THREE.Group(); c.position.copy(p); scene.add(c);
      c.add(box(.62,.08,.58,chairM,0,.48,0)); for(const [x,z] of [[-.27,-.24],[.27,-.24],[-.27,.24],[.27,.24]]) c.add(cyl(.035,.04,.48,chairM,x,.24,z,8));
      c.add(box(.62,.95,.07,chairM,0,.98,.28)); for(const sd of [-1,1]){ c.add(box(.08,.06,.56,chairM,sd*.33,.7,-.02)); c.add(cyl(.025,.025,.22,chairM,sd*.33,.58,-.26,8)); }
      return c; };
    lv.chairYou=makeChair(PIGROOM.you); lv.chairJay=makeChair(PIGROOM.jay2);
    // (a chair's back is at +z, so whoever sits faces -z: the throne)
    // your arms on the armrests, shackled
    lv.armL=makeWorldArm(1); lv.armR=makeWorldArm(-1);
    const Y=PIGROOM.you;
    for(const [a,sd] of [[lv.armL,-1],[lv.armR,1]]){ a.scale.setScalar(.62); a.position.set(Y.x+sd*.33,.745,Y.z-.2); a.rotation.set(0,sd*-.05,0); scene.add(a); }
    lv.shackles=[]; for(const a of [lv.armL,lv.armR]){ a.updateMatrixWorld(true); const s=wristShackle(iron,.56); s.position.copy(a.localToWorld(V3(0,0,-.29))); s.userData.band.rotation.y=a.rotation.y; scene.add(s); lv.shackles.push(s); }   // around YOUR wrists
    // Jay 2, chained in his chair
    const j=makeJay2(); j.userData.level='pigroom'; j.position.copy(PIGROOM.jay2); j.rotation.y=Math.PI; scene.add(j); lv.jay2=j;
    const A=j.userData.A; A.seated=true; A.idleOff=true;
    lv.jayShackles=[]; for(let i=0;i<2;i++){ const s=wristShackle(iron,.92); scene.add(s); lv.jayShackles.push(s); }   // follow Jay 2's wrists (update)
    // the pig-man on his throne
    const pig=makePigMan(); pig.position.set(T.x,.06,T.z+.1); scene.add(pig); lv.pig=pig;
    pig.userData.pig.onBite=()=>{ pigBiteMeat(pig.userData.pig); SND.play('pig_eat_'+randi(1,4),{vol:.9,pos:V3(T.x,1.9,T.z+.6),ref:3}); if(Math.random()<.5) later(.15,()=>SND.play('bite',{vol:.5,pos:V3(T.x,1.9,T.z+.6),ref:3,rate:.75})); };
    pig.userData.pig.onChew=()=>{ SND.play('chew_'+randi(1,3),{vol:.55,pos:V3(T.x,1.9,T.z+.6),ref:3,rate:.7}); };
    pig.userData.pig.onGrunt=()=>{ if(Math.random()<.75) SND.play('pig_'+randi(1,6),{vol:.95,pos:V3(T.x,1.9,T.z+.5),ref:3.5,rate:rand(.78,.9)}); };
    lv.ground=()=>0; lv.surfaceAt=()=>'stone';
    lv.col.bounds=[-W/2,W/2,zc-D/2,zc+D/2];
  },
  enter(){ FX.sunWorld=null; setAmbience([['fire',.05]]); this.lookN=0; },
  exit(){ setAmbience([]); },
  update(dt,t){
    const lv=this;
    if(lv.jayShackles&&lv.jay2.visible){ const J=lv.jay2.userData.J; lv.jay2.updateMatrixWorld(true); shackleFollow(lv.jayShackles[0],J.hdL,J.elL); shackleFollow(lv.jayShackles[1],J.hdR,J.elR); }
    // fire: flicker + embers + smoke
    for(const f of lv.fires){ const n=noise1(t*7+f.ph)*.25+noise1(t*17+f.ph*3)*.12; f.light.intensity=f.base*(1+n); 
      f.g.updateMatrixWorld(); const p=f.g.localToWorld(f.fireAt.clone());
      f.sp=(f.sp||0)-dt; if(f.sp<=0){ f.sp=f.big?.02:.05;
        lv.glow.spawn(p.x+rand(-.06,.06)*(f.big?3:1),p.y+rand(0,.05),p.z+rand(-.06,.06)*(f.big?3:1),rand(-.05,.05),rand(.5,1.1),rand(-.05,.05),rand(.25,.55),f.big?rand(.08,.16):rand(.05,.09),1,.55,.15,.9,.6,.6,-.5);
        if(Math.random()<.2) lv.glow.spawn(p.x,p.y+.1,p.z,rand(-.2,.2),rand(.6,1.4),rand(-.2,.2),rand(1,2),.012,1,.6,.2,1,-.2,.3,0);
        if(Math.random()<.25) lv.soft.spawn(p.x,p.y+.3,p.z,rand(-.05,.05),rand(.3,.5),rand(-.05,.05),rand(2,3.5),rand(.08,.15),.12,.1,.09,.18,0,.2,2.5); } }
    // crackles from the big fire
    lv.crk=(lv.crk||0)-dt; if(lv.crk<=0){ lv.crk=rand(.05,.4); const p=lv.brazier.g.position; sfxAt(V3(p.x,1,p.z),()=>{ noise(.025,rand(.03,.09),0,rand(1800,5200),'bandpass',undefined,1.6); },3); }
    animatePigMan(lv.pig,dt,t);
    // chained: you can only turn your head so far, and the chains rattle when you strain
    if(lv.chained){ const P=PLAYER; const y0=P.yaw, p0=P.pitch; P.yaw=clamp(angDiff(0,P.yaw),-1.35,1.35); P.pitch=clamp(P.pitch,-1.0,.75);
      const mv=Math.abs(angDiff(lv.prevYaw==null?P.yaw:lv.prevYaw,P.yaw))+Math.abs(P.pitch-(lv.prevPitch==null?P.pitch:lv.prevPitch)); lv.prevYaw=P.yaw; lv.prevPitch=P.pitch;
      lv.strain=(lv.strain||0)*Math.exp(-dt*3)+mv; if(lv.strain>.5&&(lv.chainCd||0)<=0){ lv.chainCd=rand(.6,1.4); lv.strain=0; SND.play('chain_'+randi(1,3),{vol:.35,pos:V3(PIGROOM.you.x,.7,PIGROOM.you.z-.3),ref:1.5}); }
      lv.chainCd=(lv.chainCd||0)-dt;
      // the arms move a little with you
      lv.armL.rotation.z=Math.sin(t*.8)*.01; lv.armR.rotation.z=-Math.sin(t*.8+1)*.01; }
  }
});
