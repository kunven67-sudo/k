/* ================================================================
   HORSES — from the stable. E = get on, F = get off. Shift = gallop.
   Jay 2 rides his own right behind you.
   ================================================================ */
function horseTex(base){ return canvasTex(256,256,(c,w,h)=>{ c.fillStyle=base; c.fillRect(0,0,w,h); for(let i=0;i<5000;i++){ c.strokeStyle='rgba('+(Math.random()<.5?'0,0,0':'255,230,200')+','+(Math.random()*.08)+')'; const x=Math.random()*w,y=Math.random()*h; c.beginPath(); c.moveTo(x,y); c.lineTo(x+rand(-1,1),y+rand(3,8)); c.stroke(); } },[2,2]); }
function makeHorse(coat=0x5a3418){ const g=new THREE.Group(); g.name='horse';
  const m=new THREE.MeshPhysicalMaterial({color:col(coat),roughness:.6,map:horseTex('#'+new THREE.Color(coat).getHexString()),sheen:col(0x6a4a30),sheenRoughness:.5});
  const dark=new THREE.MeshPhysicalMaterial({color:col(0x1a120c),roughness:.8}), hoof=mat(0x2a2420,{roughness:.6});
  const body=new THREE.Group(); body.position.y=1.42; g.add(body);
  body.add(ell(.36,.42,.95,m,0,0,0,24)); body.add(ell(.34,.4,.4,m,0,.04,.62,18)); body.add(ell(.35,.38,.42,m,0,.02,-.62,18));
  const neck=new THREE.Group(); neck.position.set(0,.22,.78); neck.rotation.x=-.75; body.add(neck); neck.add(ell(.17,.22,.48,m,0,0,.3,16));
  const head=new THREE.Group(); head.position.set(0,0,.72); head.rotation.x=1.45; neck.add(head); head.add(ell(.13,.14,.32,m,0,0,.18,16)); head.add(ell(.1,.1,.16,m,0,-.02,.44,14));
  for(const sd of [-1,1]){ head.add(ell(.025,.06,.025,m,sd*.07,.13,.02,8)); head.add(ell(.02,.02,.02,mat(0x050505,{roughness:.2}),sd*.11,.06,.2,8)); head.add(ell(.015,.015,.015,mat(0x050505),sd*.04,-.05,.58,6)); }
  const mane=box(.05,.12,.8,dark,0,.18,.3); neck.add(mane); g.userData.head=head;
  const tail=new THREE.Group(); tail.position.set(0,.2,-1.0); body.add(tail); for(let i=0;i<5;i++){ const t=cyl(.04-i*.004,.03-i*.004,.22,dark,0,-i*.18,-.04*i,6); t.rotation.x=.25; tail.add(t); } tail.rotation.x=.4;
  const legs=[]; for(const [x,z,front] of [[-.2,.62,1],[.2,.62,1],[-.2,-.62,0],[.2,-.62,0]]){ const up=new THREE.Group(); up.position.set(x,-.15,z); body.add(up); up.add(ell(.1,.32,.13,m,0,-.28,0,10));
    const kn=new THREE.Group(); kn.position.y=-.6; up.add(kn); kn.add(cyl(.045,.04,.6,m,0,-.3,0,8)); kn.add(cyl(.065,.07,.1,hoof,0,-.62,0,10)); legs.push({up,kn,front,ph:(front?0:.5)+(x>0?.25:0)}); }
  const saddle=ell(.3,.08,.35,mat(0x4a2a16,{roughness:.55}),0,.42,0,14); body.add(saddle);
  g.userData.horse={body,legs,tail,neck,ph:0,speed:0}; g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return g; }
function animateHorse(h,dt,t,speed){ const H=h.userData.horse; H.speed=damp(H.speed,speed,6,dt); const k=clamp(H.speed/14,0,1);
  H.ph+=dt*(1.2+H.speed*.38); for(const L of H.legs){ const p=(H.ph+L.ph)%1*Math.PI*2; L.up.rotation.x=Math.sin(p)*(.15+.5*k); L.kn.rotation.x=Math.max(0,-Math.cos(p))*(.3+.9*k)*(L.front?-1:1); }
  H.body.position.y=1.42+Math.abs(Math.sin(H.ph*Math.PI*2))*.06*k; H.body.rotation.x=Math.sin(H.ph*Math.PI*2)*.03*k; H.neck.rotation.x=-.75+Math.sin(H.ph*Math.PI*2)*.08*k+(k<.05?Math.sin(t*.5)*.05:0); H.tail.rotation.x=.4+k*.6+Math.sin(t*2)*.05; }
const RIDE={on:false,horse:null,j2h:null,snd:null};
function setupHorses(){ const lv=LEVELS.dust; lv.horses=[]; for(let i=0;i<3;i++){ const p=lv.stalls[i]; const h=makeHorse([0x5a3418,0x2a1a10,0x8a6a4a][i]); h.position.set(p.x,0,p.z); h.rotation.y=-Math.PI/2*B_('stable').s; lv.scene.add(h); lv.horses.push(h);
    addInteract(lv,{obj:h,offset:V3(0,1.6,0),reach:2.8,label:'Get on the horse (F = get off)',when:()=>!RIDE.on&&!NIGHT4.hidden,act:()=>mount(h)}); colCircle(lv.col,p.x,p.z,.5,()=>RIDE.horse!==h); } }
function mount(h){ RIDE.on=true; RIDE.horse=h; SND.play('horse_trot',{vol:.5}); toast('Shift = gallop · F = get off','#e8d0a0'); PLAYER.eye=2.45; PLAYER.speed=7.5;
  const lv=LEVELS.dust; const j2h=lv.horses.find(x=>x!==h&&!x.userData.taken); if(j2h&&CUR.j2){ RIDE.j2h=j2h; j2h.userData.taken=1; const J=CUR.j2; J.userData.A.path=null; J.userData.riding=j2h; setPose(J,'ride',.3); } }
function dismount(){ if(!RIDE.on) return; RIDE.on=false; PLAYER.eye=1.64; PLAYER.speed=LEVELS.dust.env.speed; const h=RIDE.horse; RIDE.horse=null; if(RIDE.snd){ RIDE.snd.stop(.3); RIDE.snd=null; }
  PLAYER.pos.add(V3(Math.cos(PLAYER.yaw)*1.2,0,-Math.sin(PLAYER.yaw)*1.2)); if(RIDE.j2h&&CUR.j2){ const J=CUR.j2; J.userData.riding=null; clearPose(J,.3); J.position.copy(RIDE.j2h.position).add(V3(1.2,0,0)); RIDE.j2h.userData.taken=0; RIDE.j2h=null; } }
on('key',code=>{ if(code==='KeyF'&&RIDE.on&&G.mode==='play'&&!DLG.active) dismount(); });
const _hv=new THREE.Vector3();
on('tick',dt=>{ if(!LV||LV.name!=='dust'||!LV.horses) return; const t=G.time;
  for(const h of LV.horses){ if(h===RIDE.horse||h===RIDE.j2h) continue; animateHorse(h,dt,t,0); }
  if(RIDE.on){ const h=RIDE.horse; const sp=Math.hypot(PLAYER.vel.x,PLAYER.vel.z); h.position.set(PLAYER.pos.x,LV.ground(PLAYER.pos.x,PLAYER.pos.z),PLAYER.pos.z); h.rotation.y=damp(h.rotation.y,PLAYER.yaw+Math.PI,10,dt); animateHorse(h,dt,t,sp);
    const want=sp>9?'horse_gallop':sp>1?'horse_trot':null; if(want!==(RIDE.snd&&RIDE.snd.name)){ if(RIDE.snd) RIDE.snd.stop(.3); RIDE.snd=want?SND.play(want,{vol:want==='horse_gallop'?.55:.4,loop:true}):null; }
    const jh=RIDE.j2h; if(jh&&CUR.j2){ _hv.set(PLAYER.pos.x-Math.sin(PLAYER.yaw+.6)*-3,0,PLAYER.pos.z-Math.cos(PLAYER.yaw+.6)*-3); const d=jh.position.distanceTo(_hv); const step=Math.min(d,(sp+2)*dt*1.2); const dir=_hv.clone().sub(jh.position).setY(0); if(dir.length()>.01){ dir.normalize(); jh.position.addScaledVector(dir,step); jh.rotation.y=Math.atan2(dir.x,dir.z); } jh.position.y=LV.ground(jh.position.x,jh.position.z); animateHorse(jh,dt,t,d>1?sp:0);
      const J=CUR.j2; J.position.copy(jh.position).add(V3(0,1.05,0)); J.rotation.y=jh.rotation.y; } } });
