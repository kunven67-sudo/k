/* ================================================================
   MARS SHIFT PART 3 — Day 3 afternoon: turn Jim's $50 into alien coins,
   buy the Dome Sweet Dome, and move into the bigger house.
   ================================================================ */
/* ================= B8: A BIGGER HOUSE ================= */
CHECKPOINTS.B8=async()=>{
  const lv=await enterLevel('mars',{pos:V3(30,0,33),yaw:0});
  setCheckpoint('B8'); const F=F_(); F.day=3; F.day3Buy=true;
  if(!lv.interSetup){ lv.interSetup=true; setupMarsInteractions(lv); }
  for(const b of lv.bugs) lv.scene.remove(b); lv.bugs.length=0; F.bugsOn=false;
  for(const h of lv.houses) h.sold=h.price===50;
  if(lv.steve) lv.steve.visible=false;
  const jim=lv.jim; jim.visible=true; jim.userData.A.path=null; jim.userData.A.sleep=false; clearPose(jim,0); setMood(jim,'happy'); jim.position.set(0,.05,-5.75); jim.rotation.y=0; jim.userData.A.faceYaw=0; jim.userData.A.look=null;
  lv.rocket.position.set(22,marsHeight(22,12)+1.1,12); setRocketFlame(lv.rocket,0);
  const tiny=lv.houses.find(h=>h.price===50); PLAYER.pos.set(tiny.door.x,0,tiny.door.z-2.2); PLAYER.yaw=Math.PI*.15; PLAYER.eye=1.64;
  PLAYER.lock(); crosshair(true); setVM(true); PLAYER.hasWatch=true; PLAYER.stitched=true;
  hudVisible(true); HUD.coins=Math.max(HUD.coins||0,50); showCoins(true); setCoins(HUD.coins,false); HUD.cash=50; showCash(true); setCash(50,false);
  playMusic('houses',1.2); setAmbience([['marsWind',.06]]);
  FX.blackout=0; await fade(0,1);
  say("You have fifty alien coins. And Jim's fifty dollars.",3.6); await wait(3.6);
  objective('Convert the $50 into alien coins');
  setMarker(()=>lv.convAlien.position.clone().add(V3(0,2.3,0)),'Alien Converter','m');
  PLAYER.free();
};
async function enterBigHouse(){
  const F=F_(); if(F.inBig) return; F.inBig=true; PLAYER.lock(); objective(null); setMarker(null);
  sfxAt(PLAYER.pos,()=>SFX.alienDoor(),2); await fade(1,.8);
  const lv=await enterLevel('bighouse',{pos:V3(0,0,8.2),yaw:0});
  setupBigHouse(lv); F.seen={}; F.noSleep=false; F.sleeping=false;
  showCash(false); showCoins(true); setCoins(HUD.coins,false);
  sfxAt(V3(0,1,9),()=>SFX.alienDoor(),2);
  await fade(0,1);
  say("It's bigger. With a lot of new stuff. Better stuff.",4.2); PLAYER.free(); await wait(4.4);
  bigObjective();
}
const BIG_THINGS=['tv','fridge','fish','arcade','tub','pc'];
function bigObjective(){ const F=F_(); const n=BIG_THINGS.filter(k=>F.seen&&F.seen[k]).length; objective('Check out the new stuff <b>'+n+'/'+BIG_THINGS.length+'</b>, then go to sleep'); }
function bigSeen(k){ const F=F_(); F.seen=F.seen||{}; if(!F.seen[k]){ F.seen[k]=true; bigObjective(); } }
function setupBigHouse(lv){
  if(lv.interSetup) return; lv.interSetup=true;
  const said=(k,lines)=>()=>{ bigSeen(k); bark('You',pick(lines),null,2.8); };
  addInteract(lv,{obj:lv.bed,offset:V3(0,.8,0),label:'Go to sleep',reach:2.8,when:()=>!F_().sleeping,act:()=>runStory(sleepBigBed)});
  addInteract(lv,{obj:lv.tv,offset:V3(0,1.6,0),label:'Watch the holo-TV',reach:3.4,act:()=>{ lv.tvOn=!lv.tvOn||true; lv.tvCh=(lv.tvCh+1)%3; lv.chSeen=lv.chSeen||new Set([0]); lv.chSeen.add(lv.tvCh); if(lv.chSeen.size>=3) unlock('couch'); SFX.holoSign(); said('tv',["Alien cartoons. I don't get them. But they're funny.","It's got like a million channels.","This TV is bigger than my old house."])(); }});
  addInteract(lv,{obj:lv.fridge,offset:V3(0,1.2,0),label:()=>lv.fridgeOpen?'Close the alien fridge':'Open the alien fridge',reach:2.4,act:()=>{ lv.fridgeOpen=!lv.fridgeOpen; SFX.doorOpen&&SFX.doorOpen(); if(lv.fridgeOpen) said('fridge',["Alien snacks. And more alien pizza.","It's full. And it glows."])(); }});
  addInteract(lv,{obj:lv.tank,offset:V3(0,1.2,0),label:'Look at the alien fish',reach:2.8,act:said('fish',["Alien fish. That one is looking at me.","They glow in the dark. Cool."])});
  addInteract(lv,{obj:lv.arcade,offset:V3(0,1.3,0),label:'Play the arcade machine',reach:2.2,act:()=>{ SFX.pcBoot(); lv.arcT=3; said('arcade',["BEEP BOOP. Game over. Already?","High score: ZZXQ. Some alien is really good at this."])(); }});
  addInteract(lv,{obj:lv.tub,offset:V3(0,.6,0),label:'Hot tub',reach:2.8,act:()=>{ SFX.bubble(); said('tub',["A hot tub. On Mars.","It's bubbling. It's purple. It's great."])(); }});
  addInteract(lv,{obj:lv.pc,offset:V3(0,1.3,0),label:'Use the alien computer',reach:2.4,act:()=>{ bigSeen('pc'); openAlienPC(PC_PAGES2); }});
  addInteract(lv,{obj:lv.couch,offset:V3(0,.8,0),label:'Couch',reach:2.4,act:()=>bark('You',"Super comfy. It's shaped like a bean.",null,2.6)});
}
const PC_PAGES2={
  home:{text:'<span class="g">⌬ XZL-OS 9001</span>\n\nWELCOME HOME, HUMAN.\nNEW HOUSE: "DOME SWEET DOME"\nHOUSE VALUE: Ѫ 100 (WOW)\n\nWhat would you like to do?',opts:[['Check bank','bank'],['Mars weather','weather'],['Shut down','off']]},
  bank:{text:'<span class="g">ALIEN BANK OF MARS</span>\n\nBALANCE: Ѫ {coins}\n\nYou spent all of it on a house.\nGood choice.',opts:[['Back','home']]},
  weather:{text:'<span class="g">MARS WEATHER</span>\n\nTONIGHT: dusty\nTOMORROW: dusty\n\nChance of bugs: 100%',opts:[['Back','home']]},
  off:{text:'SHUTTING DOWN...\n\n⌬ goodnight, human.',opts:[['Close','close']]}
};
async function sleepBigBed(){
  const F=F_(); if(F.sleeping) return; F.sleeping=true; PLAYER.lock(); objective(null); hidePrompt();
  const lv=LEVELS.bighouse; lookAtPoint(lv.bed.position.clone().add(V3(0,.7,0)),.6); await wait(.6);
  lv.setNight(true);
  say("You climb into your new, bigger bed.",3.4);
  await tweenVal(k=>{ PLAYER.eye=lerp(1.64,.95,k); PLAYER.pitch=lerp(PLAYER.pitch,.5,k*.1); },1.4);
  SFX.yawn(); playMusic(null,3);
  await tweenVal(k=>{ FX.blackout=k*.6; FX.dof=k; FX.dofFocus=.5; },2.4);
  say('You sleep.',2.6); await wait(2.4);
  await tweenVal(k=>{ FX.blackout=.6+k*.4; },1.4);
  FX.dof=0; await wait(1);
  startFromCheckpointInner('B9');
}

/* ---------- the Dome Sweet Dome: inside ---------- */
defineLevel('bighouse',{
  title:'the Dome Sweet Dome',
  env:{fx:{exposure:1.08,saturation:1.12,contrast:1.06,bloomStrength:.32,bloomThreshold:1.15,aoRadius:.5,vignette:.38,temp:-.04},music:'alienHome',reverb:.32,amb:[['alienHome',.02]],ambEvents:[['alienHum',7]],surface:'tile',far:220},
  async build(scene,lv){
    scene.background=col(0x0a0612);
    lv.envMap=makeEnv({top:0x3a2a5a,horizon:0x2a1a3a,bottom:0x100818,lights:[{x:0,y:20,z:0,w:20,h:20,c:0xb08aff,k:2},{x:20,y:5,z:0,w:6,h:6,c:0x6dffd8,k:1.5},{x:-20,y:6,z:4,w:6,h:6,c:0xff9ae8,k:1.2}]});
    const rig=makeRig(scene,{sun:.8,sunColor:0xffd0b0,hemi:.6,sky:0x9a7aff,ground:0x2a1a3a,dir:V3(.5,.6,.3),span:12,dist:24,far:50}); lv.rig=rig;
    const R=9.5, SY=.7;
    // floor: the same hex tiles, but wider and with warmer seams
    const hexT=texSet('alienFloor',512,(x,w,h)=>{ x.fillStyle='#1a1026'; x.fillRect(0,0,w,h); const r=40; for(let j=-1;j<h/(r*1.5)+1;j++) for(let i=-1;i<w/(r*1.73)+1;i++){ const cx=i*r*1.73+(j%2)*r*.86, cy=j*r*1.5; const g=x.createRadialGradient(cx,cy,0,cx,cy,r); g.addColorStop(0,'#4a3068'); g.addColorStop(1,'#2a1a40'); x.fillStyle=g; x.beginPath(); for(let q=0;q<6;q++){ const a=q/6*Math.PI*2+Math.PI/6; x.lineTo(cx+Math.cos(a)*r*.92,cy+Math.sin(a)*r*.92); } x.fill(); } },{strength:2.5});
    const seamT=canvasTex(512,512,(x,w,h)=>{ x.fillStyle='#000'; x.fillRect(0,0,w,h); const r=40; x.strokeStyle='#ff9ae8'; x.lineWidth=3; for(let j=-1;j<h/(r*1.5)+1;j++) for(let i=-1;i<w/(r*1.73)+1;i++){ const cx=i*r*1.73+(j%2)*r*.86, cy=j*r*1.5; x.beginPath(); for(let q=0;q<=6;q++){ const a=q/6*Math.PI*2+Math.PI/6; x.lineTo(cx+Math.cos(a)*r*.97,cy+Math.sin(a)*r*.97); } x.stroke(); } });
    const fm=repeatSet(hexT,5,5); seamT.repeat.set(5,5);
    const floor=mesh(new THREE.CircleGeometry(R,72),new THREE.MeshPhysicalMaterial({map:fm.map,normalMap:fm.normalMap,roughness:.3,clearcoat:.7,emissive:col(0xffffff),emissiveMap:seamT,emissiveIntensity:.4}),0,0,0,false); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor); lv.floorMat=floor.material;
    // walls + ribs + veins
    const wallT=texSet('alienWall',512,(x,w,h)=>{ noiseFill(x,w,h,n=>{ const k=.75+n*.45; return [158*k,118*k,190*k]; },5,4); for(let i=0;i<24;i++){ x.strokeStyle=`rgba(255,200,255,${rand(.04,.1)})`; x.lineWidth=rand(2,6); x.beginPath(); const xx=rand(0,w); x.moveTo(xx,0); x.bezierCurveTo(xx+rand(-40,40),h*.3,xx+rand(-40,40),h*.6,xx+rand(-20,20),h); x.stroke(); } },{strength:2});
    const wm=repeatSet(wallT,6,2);
    const wallM=new THREE.MeshPhysicalMaterial({map:wm.map,normalMap:wm.normalMap,roughness:.55,side:THREE.BackSide,clearcoat:.35,color:col(0xf0e8ff)});
    const dome=mesh(new THREE.SphereGeometry(R,72,36,0,Math.PI*2,0,Math.PI/2),wallM,0,0,0,false); dome.scale.y=SY; dome.receiveShadow=true; scene.add(dome);
    const ribM=new THREE.MeshPhysicalMaterial({color:col(0x5a3a7a),roughness:.4,clearcoat:.8});
    for(let i=0;i<14;i++){ const hd=new THREE.Group(); hd.rotation.y=i/14*Math.PI*2; const rib=mesh(new THREE.TorusGeometry(R-.06,.12,8,48,Math.PI/2),ribM,0,0,0,false); rib.scale.set(1,SY,1); hd.add(rib); scene.add(hd);
      const vh=new THREE.Group(); vh.rotation.y=i/14*Math.PI*2+Math.PI/14; const v=mesh(new THREE.TorusGeometry(R-.09,.02,6,56,Math.PI/2),emissiveMat(i%2?0xff7af0:0x6dffd8,1.6),0,0,0,false); v.scale.set(1,SY,1); vh.add(v); scene.add(vh); }
    const base=mesh(new THREE.TorusGeometry(R-.14,.06,8,120),emissiveMat(0x6dffd8,2.2),0,.12,0,false); base.rotation.x=Math.PI/2; scene.add(base);
    // a glowing skylight ring at the top of the dome
    const sky=mesh(new THREE.CircleGeometry(1.6,48),new THREE.MeshBasicMaterial({color:col(0xffd8b0).multiplyScalar(1.6)}),0,R*SY-.05,0,false); sky.rotation.x=Math.PI/2; scene.add(sky);
    const skyR=mesh(new THREE.TorusGeometry(1.65,.12,10,48),ribM,0,R*SY-.08,0,false); skyR.rotation.x=Math.PI/2; scene.add(skyR);
    lv.pls=[];
    for(let i=0;i<4;i++){ const pl=new THREE.PointLight(col([0x9a7aff,0x6dffd8,0xff9ae8,0xffd0a0][i]),1.7,13,2); pl.position.set(Math.cos(i*1.57+.5)*4.2,3.4,Math.sin(i*1.57+.5)*4.2); scene.add(pl); lv.pls.push(pl); }
    // floating lamp orbs
    lv.orbs=[];
    for(let i=0;i<9;i++){ const a=i/9*6.28, r=rand(3,6.8); const o=sph(rand(.14,.24),emissiveMat(pick([0x6dffd8,0xff7af0,0xffd070,0xb08aff]),2.6),Math.cos(a)*r,rand(2.8,4.2),Math.sin(a)*r,16,12,false); scene.add(o); lv.orbs.push({o,y:o.position.y,ph:rand(0,6)}); }
    // big panoramic window + two round ones, all looking out at Mars
    const winT=canvasTex(1024,512,(x,w,h)=>{ let g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#7a4a3a'); g.addColorStop(.5,'#e8b890'); g.addColorStop(.58,'#b8703a'); g.addColorStop(1,'#6a3a20'); x.fillStyle=g; x.fillRect(0,0,w,h); x.fillStyle='#9a4a28'; x.beginPath(); x.moveTo(0,h*.6); for(let i=0;i<=20;i++) x.lineTo(i*w/20,h*.52-Math.abs(Math.sin(i*1.3))*50); x.lineTo(w,h*.6); x.fill(); x.fillStyle='#fff8e8'; x.beginPath(); x.arc(w*.78,h*.2,16,0,7); x.fill(); for(let i=0;i<9;i++){ x.fillStyle=i%3?'#e8e0d8':'#c8d8e8'; const hx=60+i*105, hh=rand(24,70); x.beginPath(); x.arc(hx,h*.56,hh*.5,Math.PI,0); x.fill(); } });
    lv.wins=[];
    { const hold=new THREE.Group(); scene.add(hold); const win=mesh(new THREE.PlaneGeometry(5.2,2.1),new THREE.MeshBasicMaterial({map:winT}),0,2.2,-R+1.45,false); win.material.color.setScalar(1.5); hold.add(win); lv.wins.push(win);
      const fr=new THREE.Group(); fr.position.set(0,2.2,-R+1.47); hold.add(fr); for(const [w,h,x,y] of [[5.5,.16,0,1.1],[5.5,.16,0,-1.1],[.16,2.3,-2.7,0],[.16,2.3,2.7,0],[.08,2.1,-.9,0],[.08,2.1,.9,0]]) fr.add(box(w,h,.12,ribM,x,y,0,false)); colBox(lv.col,-2.8,2.8,-R,-R+1.6); }
    for(const a of [Math.PI*.5,-Math.PI*.5]){ const hold=new THREE.Group(); hold.rotation.y=a; scene.add(hold);
      const win=mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({map:winT}),0,2,-R+.5,false); win.material.color.setScalar(1.5); hold.add(win); lv.wins.push(win);
      hold.add(mesh(new THREE.TorusGeometry(1.05,.15,12,48),ribM,0,2,-R+.52,false)); colFromObj(lv.col,hold,{pad:.05}); }
    const shellM=new THREE.MeshPhysicalMaterial({color:col(0xe8e0f0),roughness:.22,clearcoat:1});
    const softM=new THREE.MeshPhysicalMaterial({color:col(0x6a4ab8),roughness:.9,sheen:col(0xb08aff)});
    // ---- the king-size pod bed with a glowing canopy ----
    const bed=new THREE.Group(); bed.position.set(-5.4,0,-3.2); bed.rotation.y=.75; scene.add(bed); lv.bed=bed;
    const shell=mesh(new THREE.SphereGeometry(1,48,24,0,Math.PI*2,Math.PI/2,Math.PI/2),shellM,0,.6,0); shell.scale.set(1.7,.6,1.9); bed.add(shell);
    const mat_=mesh(new THREE.SphereGeometry(1,48,24),softM,0,.6,0); mat_.scale.set(1.55,.2,1.75); bed.add(mat_);
    for(const x of [-.6,.6]){ const pil=mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshPhysicalMaterial({color:col(0xd8c8ff),roughness:.9,sheen:col(0xffffff)}),x,.8,-1.3); pil.scale.set(.5,.13,.26); bed.add(pil); }
    const blanket=mesh(new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI*.35),new THREE.MeshPhysicalMaterial({color:col(0x3ad8b0),roughness:.85,sheen:col(0xb0fff0)}),0,.35,.35); blanket.scale.set(1.5,.55,1.3); bed.add(blanket);
    const ring=mesh(new THREE.TorusGeometry(1,.045,8,64),emissiveMat(0x6dffd8,2),0,.61,0,false); ring.scale.set(1.72,1.92,1); ring.rotation.x=Math.PI/2; bed.add(ring);
    for(let i=0;i<3;i++){ const arc=mesh(new THREE.TorusGeometry(1.5,.04,8,40,Math.PI),i===1?ribM:emissiveMat(0xff7af0,1.4),0,.6,-1.2+i*1.2,false); arc.scale.y=1.6; bed.add(arc); }
    colOBB(lv.col,-5.4,-3.2,3.4,3.8,.75);
    // nightstands with lamps
    for(const sd of [-1,1]){ const p=bed.localToWorld(V3(sd*2.2,0,-1.2)); const ns=new THREE.Group(); ns.position.copy(p); scene.add(ns); ns.add(cyl(.06,.14,.6,ribM,0,.3,0,12)); ns.add(mesh(new THREE.CylinderGeometry(.36,.32,.08,24),shellM,0,.64,0)); ns.add(sph(.14,emissiveMat(0xffd070,2.4),0,.84,0,16,12,false)); colCircle(lv.col,p.x,p.z,.36); }
    // ---- living area: a bean couch facing a giant holo-TV ----
    const tv=new THREE.Group(); tv.position.set(5.6,0,-3.6); tv.rotation.y=-.9; scene.add(tv); lv.tv=tv;
    tv.add(rbox(3.2,.3,.6,.1,shellM,0,.15,0)); tv.add(cyl(.05,.05,.8,ribM,0,.7,0,8));
    lv.tvC=document.createElement('canvas'); lv.tvC.width=320; lv.tvC.height=180; lv.tvTex=new THREE.CanvasTexture(lv.tvC); lv.tvTex.encoding=THREE.sRGBEncoding; lv.tvCh=0;
    const scr=mesh(new THREE.PlaneGeometry(3.4,1.9),new THREE.MeshBasicMaterial({map:lv.tvTex,toneMapped:false}),0,1.95,0,false); tv.add(scr);
    tv.add(mesh(new THREE.TorusGeometry(1,.02,6,4),emissiveMat(0x6dffd8,1.5),0,1.95,-.01,false)).children; tv.children[tv.children.length-1].scale.set(2.45,1.35,1); tv.children[tv.children.length-1].rotation.z=Math.PI/4;
    colOBB(lv.col,5.6,-3.6,3.2,.7,-.9);
    const couch=new THREE.Group(); couch.position.set(2.6,0,-.9); couch.rotation.y=Math.PI-.9+Math.PI; scene.add(couch); lv.couch=couch;
    const cm=new THREE.MeshPhysicalMaterial({color:col(0xff7ab8),roughness:.85,sheen:col(0xffc8e8)});
    const seat=mesh(new THREE.TorusGeometry(1.3,.38,16,40,Math.PI),cm,0,.38,0); seat.rotation.x=Math.PI/2; seat.scale.set(1,1,.6); couch.add(seat);
    const back=mesh(new THREE.TorusGeometry(1.55,.22,12,40,Math.PI),cm,0,.8,0); back.rotation.x=Math.PI/2+.25; back.scale.set(1,1,1.2); couch.add(back);
    couch.rotation.y=-.9+Math.PI*.5; colFromObj(lv.col,couch,{pad:.05});
    // ---- kitchen: counter + tall alien fridge ----
    const kit=new THREE.Group(); kit.position.set(6.6,0,2.8); kit.rotation.y=-2.2; scene.add(kit);
    kit.add(rbox(3,.95,.8,.08,shellM,0,.48,0)); kit.add(box(3.02,.06,.82,new THREE.MeshPhysicalMaterial({color:col(0x2a1a40),roughness:.1,clearcoat:1}),0,.98,0));
    for(let i=0;i<3;i++) kit.add(sph(.1,new THREE.MeshPhysicalMaterial({color:col(pick([0x9aff7a,0xff7ae0,0xffcc33])),roughness:.2,clearcoat:1,emissive:col(0x222222)}),-1+i*.3,1.1,0,12,10));
    colOBB(lv.col,6.6,2.8,3,.9,-2.2);
    const fr=new THREE.Group(); fr.position.copy(kit.localToWorld(V3(2.1,0,0))); fr.rotation.y=-2.2; scene.add(fr); lv.fridge=fr;
    fr.add(rbox(1,2.3,.8,.12,shellM,0,1.15,0));
    const inside=box(.86,2.1,.05,emissiveMat(0x6dffd8,.9),0,1.15,.36,false); fr.add(inside);
    for(let i=0;i<9;i++) fr.add(sph(.07,emissiveMat(pick([0x9aff5a,0xff7af0,0xffcc33]),2),rand(-.3,.3),.4+(i%3)*.6+.2,.3,10,8,false));
    const door=new THREE.Group(); door.position.set(.5,0,.41); fr.add(door); door.add(rbox(1,2.3,.08,.04,new THREE.MeshPhysicalMaterial({color:col(0xc8b8e0),roughness:.2,clearcoat:1}),-.5,1.15,0)); door.add(box(.05,.8,.06,emissiveMat(0xff7af0,2),-.9,1.2,.06,false)); lv.fridgeDoor=door; lv.fridgeOpen=false;
    colCircle(lv.col,fr.position.x,fr.position.z,.6);
    // ---- aquarium column with glowing alien fish ----
    const tk=new THREE.Group(); tk.position.set(-6.8,0,2.6); scene.add(tk); lv.tank=tk;
    tk.add(cyl(.9,1,.3,ribM,0,.15,0,32)); tk.add(cyl(.9,.9,.2,ribM,0,2.55,0,32));
    tk.add(mesh(new THREE.CylinderGeometry(.85,.85,2.2,40,1,true),new THREE.MeshPhysicalMaterial({color:col(0x5ad8ff),roughness:.05,transparent:true,opacity:.28,clearcoat:1,side:THREE.DoubleSide,depthWrite:false}),0,1.4,0,false));
    tk.add(pointLightAt(0x5ad8ff,1.2,4,0,1.4,0));
    lv.fish=[]; for(let i=0;i<7;i++){ const f=new THREE.Group(); const b=sph(.08,emissiveMat(pick([0xff7af0,0xffcc33,0x9aff5a,0x6dffd8]),2.2),0,0,0,12,8,false); b.scale.set(.144,.072,.056); f.add(b); const tl=mesh(GC('fishTail',()=>{ const c=new THREE.ConeGeometry(.06,.12,6); c.rotateZ(Math.PI/2); return c; }),b.material,-.18,0,0,false); f.add(tl); tk.add(f); lv.fish.push({f,r:rand(.2,.65),y:rand(.6,2.2),sp:rand(.4,1)*(Math.random()<.5?-1:1),ph:rand(0,6)}); }
    lv.bub=0; colCircle(lv.col,-6.8,2.6,1.05);
    // ---- arcade cabinet ----
    const ar=new THREE.Group(); ar.position.set(-3.2,0,6.4); ar.rotation.y=Math.PI*.85; scene.add(ar); lv.arcade=ar;
    ar.add(box(.8,1.8,.7,new THREE.MeshPhysicalMaterial({color:col(0x2a1a4a),roughness:.3,clearcoat:1}),0,.9,0)); ar.add(box(.82,.05,.72,emissiveMat(0xff7af0,2),0,1.82,0,false));
    lv.arcC=document.createElement('canvas'); lv.arcC.width=128; lv.arcC.height=128; lv.arcTex=new THREE.CanvasTexture(lv.arcC); lv.arcTex.encoding=THREE.sRGBEncoding; lv.arcT=0;
    const as=mesh(new THREE.PlaneGeometry(.62,.55),new THREE.MeshBasicMaterial({map:lv.arcTex,toneMapped:false}),0,1.35,.36,false); as.rotation.x=-.18; ar.add(as);
    ar.add(box(.7,.1,.3,mat(0x1a1030),0,.98,.45)); ar.add(sph(.04,emissiveMat(0xff3a3a,2.5),-.15,1.05,.5,10,8,false)); ar.add(sph(.04,emissiveMat(0x3aff6a,2.5),.1,1.05,.5,10,8,false));
    colCircle(lv.col,-3.2,6.4,.55);
    // ---- purple bubbling hot tub ----
    const tub=new THREE.Group(); tub.position.set(-1.8,0,-6.2); scene.add(tub); lv.tub=tub;
    tub.add(mesh(new THREE.TorusGeometry(1.3,.22,12,48),shellM,0,.42,0)).children; tub.children[0].rotation.x=Math.PI/2;
    tub.add(cyl(1.3,1.3,.42,shellM,0,.21,0,40));
    const water=mesh(new THREE.CircleGeometry(1.25,40),new THREE.MeshPhysicalMaterial({color:col(0x9a5aff),roughness:.05,clearcoat:1,emissive:col(0x5a1aaa),emissiveIntensity:.8,transparent:true,opacity:.85}),0,.46,0,false); water.rotation.x=-Math.PI/2; tub.add(water); lv.water=water;
    tub.add(pointLightAt(0xb08aff,1.4,4,0,.8,0));
    colCircle(lv.col,-1.8,-6.2,1.5);
    // ---- better computer: three holo screens ----
    const pc=new THREE.Group(); pc.position.set(4.6,0,5.8); pc.rotation.y=Math.PI+.6; scene.add(pc); lv.pc=pc;
    pc.add(rbox(1.8,.9,.7,.15,shellM,0,.45,0)); pc.add(cyl(.05,.05,.7,ribM,0,1.25,0,8));
    lv.pcScreen={c:document.createElement('canvas')}; lv.pcScreen.c.width=256; lv.pcScreen.c.height=160; lv.pcScreen.tex=new THREE.CanvasTexture(lv.pcScreen.c); lv.pcScreen.tex.encoding=THREE.sRGBEncoding;
    for(const [x,ry] of [[-1.05,.45],[0,0],[1.05,-.45]]){ const s=mesh(new THREE.PlaneGeometry(1,.62),new THREE.MeshBasicMaterial({map:lv.pcScreen.tex,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),x,1.75,Math.abs(x)*.2,false); s.rotation.y=ry; pc.add(s); }
    colCircle(lv.col,4.6,5.8,1.05);
    // ---- plants, rugs, the door ----
    makeBushes(scene,[{x:-7.6,z:-1,h:1.6,r:.7},{x:7.8,z:-.6,h:1.4,r:.6},{x:1.8,z:7.9,h:1.2,r:.5},{x:-.8,z:-8,h:1.3,r:.55}],{seed:91,tint:0xd8a0ff});
    for(const [x,z,r] of [[2.4,-1.8,2.2],[-4.8,-1.5,1.6]]){ const rug=mesh(new THREE.CircleGeometry(r,48),new THREE.MeshStandardMaterial({map:canvasTex(256,256,(c,w,h)=>{ c.fillStyle='#2a1a4a'; c.fillRect(0,0,w,h); for(let i=0;i<7;i++){ c.strokeStyle=i%2?'#ffd070':'#ff7af0'; c.lineWidth=5; c.beginPath(); c.arc(128,128,16+i*16,0,7); c.stroke(); } }),roughness:1}),x,.01,z,false); rug.rotation.x=-Math.PI/2; scene.add(rug); }
    const dm=mesh(new THREE.CircleGeometry(1.2,32,0,Math.PI),new THREE.MeshPhysicalMaterial({color:col(0x3a2a4a),clearcoat:1,roughness:.3}),0,0,R-.35,false); dm.rotation.y=Math.PI; scene.add(dm);
    const dRing=mesh(new THREE.RingGeometry(1.2,1.34,40,1,0,Math.PI),emissiveMat(0x6dffd8,2.2),0,0,R-.36,false); dRing.rotation.y=Math.PI; scene.add(dRing);
    // robot vacuum doing laps
    const rv=new THREE.Group(); scene.add(rv); lv.vac=rv; rv.add(cyl(.22,.24,.08,shellM,0,.05,0,24)); rv.add(sph(.04,emissiveMat(0x6dffd8,3),0,.1,.12,8,6,false));
    lv.col.radius=R-.45; lv.col.cx=0; lv.col.cz=0;
  },
  enter(){ FX.sunWorld=null; this.setNight(false); },
  setNight(on){ for(const w of this.wins) w.material.color.set(on?0x2a2450:0xffffff).multiplyScalar(on?1:1.5); for(const pl of this.pls) pl.intensity=on?.7:1.7; if(this.rig&&this.rig.hemi) this.rig.hemi.intensity=on?.28:.6; },
  update(dt,t){
    const lv=this;
    lv.floorMat.emissiveIntensity=.32+Math.sin(t*.8)*.12;
    for(const o of lv.orbs) o.o.position.y=o.y+Math.sin(t*.9+o.ph)*.12;
    for(const f of lv.fish){ const a=t*f.sp+f.ph; f.f.position.set(Math.cos(a)*f.r,f.y+Math.sin(t*1.3+f.ph)*.12,Math.sin(a)*f.r); f.f.rotation.y=-a-(f.sp>0?Math.PI/2:-Math.PI/2); }
    lv.bub-=dt; if(lv.bub<=0){ lv.bub=.12; const tp=lv.tank.position; lv.glow.spawn(tp.x+rand(-.5,.5),.4,tp.z+rand(-.5,.5),0,rand(.4,.8),0,rand(2,3),rand(.02,.04),.6,.9,1,.5,0,0,1);
      const up=lv.tub.position; lv.soft.spawn(up.x+rand(-1,1),.5,up.z+rand(-1,1),0,rand(.2,.4),0,rand(1.5,2.5),rand(.15,.3),.85,.8,1,.18,0,-.02,1.5); }
    lv.water.position.y=.46+Math.sin(t*6)*.006;
    lv.fridgeDoor.rotation.y=damp(lv.fridgeDoor.rotation.y,lv.fridgeOpen?-1.9:0,6,dt);
    const va=t*.25; lv.vac.position.set(Math.cos(va)*6.2,0,Math.sin(va)*3.5+1.6); lv.vac.rotation.y=-va;
    // TV: a little alien cartoon (a bouncing blob) on three channels
    lv.tvT=(lv.tvT||0)+dt; if(lv.tvT>.066){ lv.tvT=0; const x=lv.tvC.getContext('2d'), W=320, H=180, ch=lv.tvCh;
      const bg=[['#3a1a6a','#ff7af0'],['#0a3a4a','#6dffd8'],['#4a2a0a','#ffcc33']][ch]; let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,bg[0]); g.addColorStop(1,'#000'); x.fillStyle=g; x.fillRect(0,0,W,H);
      const bx=160+Math.sin(t*1.3)*90, by=130-Math.abs(Math.sin(t*3.2))*70; x.fillStyle=bg[1]; x.beginPath(); x.ellipse(bx,by,26+Math.sin(t*6.4)*4,22-Math.sin(t*6.4)*4,0,0,7); x.fill();
      x.fillStyle='#fff'; x.beginPath(); x.arc(bx-8,by-5,6,0,7); x.arc(bx+8,by-5,6,0,7); x.fill(); x.fillStyle='#000'; x.beginPath(); x.arc(bx-7+Math.sin(t)*2,by-5,3,0,7); x.arc(bx+9+Math.sin(t)*2,by-5,3,0,7); x.fill();
      x.fillStyle='rgba(255,255,255,.12)'; for(let i=0;i<H;i+=3) x.fillRect(0,i,W,1); x.fillStyle='#fff'; x.font='bold 14px monospace'; x.fillText(['⌬ BLOB TIME','⌬ SPACE NEWS','⌬ COOKING W/ ZORP'][ch],10,20); lv.tvTex.needsUpdate=true; }
    // arcade attract screen
    lv.arcT2=(lv.arcT2||0)+dt; if(lv.arcT2>.1){ lv.arcT2=0; const x=lv.arcC.getContext('2d'); x.fillStyle='#050510'; x.fillRect(0,0,128,128); x.fillStyle='#9aff5a'; for(let r=0;r<3;r++) for(let c=0;c<6;c++){ const ox=12+c*18+Math.sin(t*2)*8, oy=18+r*14+(t*3%20); x.fillRect(ox,oy,10,6); x.fillRect(ox+2,oy+6,2,2); x.fillRect(ox+6,oy+6,2,2); } x.fillStyle='#6dffd8'; x.fillRect(58+Math.sin(t*1.7)*40,112,12,6); x.fillStyle='#fff'; x.font='bold 10px monospace'; x.fillText(lv.arcT>0?'GAME OVER':'ALIEN INVADERS',lv.arcT>0?34:22,10); lv.arcTex.needsUpdate=true; if(lv.arcT>0) lv.arcT-=.1; }
    // computer screens
    lv.pcT=(lv.pcT||0)+dt; if(lv.pcT>.1){ lv.pcT=0; const x=lv.pcScreen.c.getContext('2d'); x.fillStyle='rgba(0,10,8,.9)'; x.fillRect(0,0,256,160); x.fillStyle='#6dffd8'; x.font='bold 18px monospace'; x.fillText('⌬ XZL-OS 9001',10,24); x.font='13px monospace'; for(let i=0;i<6;i++){ x.fillStyle=`rgba(109,255,216,${.4+.4*Math.sin(t*3+i)})`; x.fillText(['◇◈◊⟡ ⌬⍜','⟟⊑⋔⟒ ⌇⟒⏁','⊬⍜⎍ ⊑⏃⎐⟒ Ѫ0','WELCOME HOME','⌿⍀⟒⌇⌇ ⟒','▮▮▮▮▮▮▯'][i],10,50+i*18); } lv.pcScreen.tex.needsUpdate=true; }
  }
});
function pointLightAt(c,k,d,x,y,z){ const p=new THREE.PointLight(col(c),k,d,2); p.position.set(x,y,z); return p; }

